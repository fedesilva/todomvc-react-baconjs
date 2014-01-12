/**
 * @jsx React.DOM
 */
/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
/*global Utils, ALL_TODOS, ACTIVE_TODOS, COMPLETED_TODOS,
  TodoItem, TodoFooter, React, Router*/

(function (window, React) {
  'use strict';

  window.ALL_TODOS = 'all';
  window.ACTIVE_TODOS = 'active';
  window.COMPLETED_TODOS = 'completed';

  var ENTER_KEY = 13;

  var TodoApp = React.createClass({

    getDefaultProps: function () {
      return {
        itemstream: new Bacon.Bus()
      };
    },

    getInitialState: function () {
      // var todosSt = Utils.store('react-todos');
      var todos = Utils.collectOb(this.props.itemstream);
      return {
        todos: todos,
        nowShowing: ALL_TODOS,
      };
    },

    componentDidUpdate: function () {
      //Utils.store('react-todos', this.state.todos);
    },

    componentDidMount: function () {
      var router = Router({
                 '/': this.setState.bind(this, {nowShowing: ALL_TODOS}),
           '/active': this.setState.bind(this, {nowShowing: ACTIVE_TODOS}),
        '/completed': this.setState.bind(this, {nowShowing: COMPLETED_TODOS})
      });
      router.init();
      this.refs.newField.getDOMNode().focus();
      // If we get a new todo item we trigger re-rendering
      this.props.itemstream.onValue(this.someThingChanged);
    },

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Own methods
    ////////////////////////////////////////////////////////////////////////////////////////////////
    someThingChanged: function() {
      this.setState();
    },

    handleNewTodoKeyDown: function (event) {
      if (event.which !== ENTER_KEY) {
        return;
      }
      var val = this.refs.newField.getDOMNode().value.trim();
      if (val) {
        var newTodo = {
          id:        Utils.uuid(),
          title:     val,
          deleted:   false,
          completed: false
        };
        var model = new Bacon.Model(newTodo);
        this.props.itemstream.push(model);
        model.onValue(this.someThingChanged);
        this.refs.newField.getDOMNode().value = '';
      }
      return false;
    },

    toggleAll: function (event) {
      var checked = event.target.checked;
      this.state.todos.map(function (todo) {
        todo.lens('completed').set(checked);
      });
    },

    clearCompleted: function () {
      this.state.todos.forEach(function(t) {
        t.modify(function(el) {
          if( el.completed ) {
            el.deleted = true;
          }
          return el
        });
      });
      this.someThingChanged();
    },

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Rendering
    ////////////////////////////////////////////////////////////////////////////////////////////////
    render: function () {
      var footer = null;
      var main = null;
      var nonDeleted = this.state.todos.filter(function(todo) {
        return !todo.get().deleted;
      }, this);

      var shownTodos = nonDeleted.filter(function (todo) {
        switch (this.state.nowShowing) {
        case ACTIVE_TODOS:
          return !todo.get().completed;
        case COMPLETED_TODOS:
          return todo.get().completed;
        default:
          return true;
        }
      }, this);

      var todoItems = shownTodos.map(function (todo) {
        return (
          <TodoItem
            key={todo.get().id}
            todo={todo}
          />
        );
      }, this);

      var activeTodoCount = nonDeleted.reduce(function(accum, todo) {
        return todo.get().completed ? accum : accum + 1;
      }, 0);

      var completedCount = nonDeleted.length - activeTodoCount;

      if (activeTodoCount || completedCount) {
        footer =
          <TodoFooter
            count={activeTodoCount}
            completedCount={completedCount}
            onClearCompleted={this.clearCompleted}
          />;
      }

      if (nonDeleted.length) {
        main = (
          <section id="main">
            <input
              id="toggle-all"
              type="checkbox"
              onChange={this.toggleAll}
              checked={activeTodoCount === 0}
            />
            <ul id="todo-list">
              {todoItems}
            </ul>
          </section>
        );
      }

      return (
        <div>
          <header id="header">
            <h1>todos</h1>
            <input
              ref="newField"
              id="new-todo"
              placeholder="What needs to be done?"
              onKeyDown={this.handleNewTodoKeyDown}
            />
          </header>
          {main}
          {footer}
        </div>
      );
    }
  });

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Undoing
  //////////////////////////////////////////////////////////////////////////////////////////////////
  var UndoComp = React.createClass({
    getInitialState: function() {
      return {history: [], future:[]};
    },

    componentDidMount: function() {
      this.props.itemstream.onValue( this.onNewItem );
    },

    onNewItem: function(item) {
      // The undoing of a new item is to delete it:
      this.myPush(this.deleteItem.bind(this,item));
      // We also listen to any item change now which we also push
      item.withStateMachine(false, this.detectUndos).slidingWindow(2,2).
           onValue( this.onModelChange.bind(this,item) );
    },

    detectUndos: function(isUndo, ev) {
      // State changes:
      if(!isUndo && ev.hasValue() && '_UNDO' in ev.value() && ev.value()._UNDO)
         return [true, []]
      if(isUndo && ev.hasValue() && '_UNDO' in ev.value() && !ev.value()._UNDO)
         return [false, []]
      // If no statechanges: Just put it out:
      if(isUndo) return [true, []]; //we're in the middle of a state change. No value
      else return [false, [ev]] // Operating as normal...
    },

    myPush: function(val) {
      this.state.history.push(val);
      this.setState();
    },

    deleteItem: function(which, isRedo) {
      // This is implementation specific but we could easily make this a callback props
      which.lens("_UNDO").set(true);
      if( isRedo ) {
        which.lens('deleted').set(false);
      } else {
        which.lens('deleted').set(true);
      }
      which.lens("_UNDO").set(false);
    },

    onModelChange: function(item, ab) {
      this.myPush(function(isRedo) {
        item.lens("_UNDO").set(true);
        if(isRedo) {
          item.set(ab[1]);
        } else {
          item.set(ab[0]); // Undoing a change is simple setting it to the old value (new val: ab[1])
        }
        item.lens("_UNDO").set(false);
      });
    },

    redo: function () {
      var f = this.state.future.pop();
      this.state.history.push(f);
      f(true); // Redo whatever needs to be redone
      this.setState(); // refresh UI
    },

    undo: function () {
      var f = this.state.history.pop();
      this.state.future.push(f);
      f(false); // Undo whatever needs to be undone
      this.setState(); // refresh UI
    },

    render: function () {
      return <div>
               <input type="button" value="Undo" ref="undo" onClick={this.undo} />
               <input type="button" value="Redo" ref="redo" onClick={this.redo} />
               <span>{this.state.history.length} items to go back<br /></span>
               <span>{this.state.future.length} items to go forward<br /></span>
             </div>
    },
  });

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Main app hooks
  //////////////////////////////////////////////////////////////////////////////////////////////////
  var itemstream = new Bacon.Bus(); // Event stream
  React.renderComponent(<UndoComp itemstream={itemstream} />, document.getElementById('undocomp'));
  React.renderComponent(<TodoApp itemstream={itemstream} />, document.getElementById('todoapp'));
  React.renderComponent(
    <div>
      <p>Double-click to edit a todo</p>
      <p>Created by{' '}
        <a href="http://github.com/hura/">hura</a>
      </p>
      <p>Part of{' '}<a href="http://todomvc.com">TodoMVC</a></p>
    </div>,
    document.getElementById('info'));
})(window, React);

