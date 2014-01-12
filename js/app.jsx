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
      //return {undo: 0, redo: 0};
      return {history: [], future:[]};
    },

    componentDidMount: function() {
      this.props.itemstream.onValue( this.onNewItem );
    },

    onNewItem: function(item) {
      // The undoing of a new item is to delete it:
      var ff = this.deleteItem.bind(this, item);
      this.myPush(this.deleteItem.bind(this,item));
      // We also listen to any item change now which we also push
      item.slidingWindow(2,2).onValue( this.onModelChange );
    },

    myPush: function(val) {
      console.assert(typeof val == 'function');
      this.state.history.push(val);
      this.setState();
    },

    deleteItem: function(which) {
      // This is implementation specific but we could easily make this a callback props
      console.log("deleteItem");
      console.log(which);
      which.lens('deleted').set(true);
    },

    onModelChange: function(oldVal, newVal) {
      // When a model changes, the undoing of this is to push the old model value
      console.log("onModelChange old:"+oldVal);
      console.log("onModelChange new:"+newVal);
      //var o = oldVal.get();
      //var n = newVal;
      //this.myPush( function() {
      //  n.set(o);
      //});
    },

    redo: function () {
      //
    },

    undo: function () {
      var undoaction = this.state.history.pop();
      console.log("Undoaction:");
      console.log(undoaction);
      undoaction();
      this.setState();
      // this.state.future.push(undoaction
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

