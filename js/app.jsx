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

  var UNDO_FLAG = '_UNDO_';

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
  // Random notes:
  // Bacon.model will 'emit' multiple changes when we set multiple fields at one and not just emit
  // a single item update. For instance, from the Bacon.Model tests:
  // root.set({first:"f", last:"l"})
  //  expect(values).to.deep.equal([
  //    {}, 
  //    {first: "f"}, // First emits this
  //    {first: "f", last: "l"}]) // Then this
  // Thus,
  // For more complex models we'd have to also emit a "_IS_TRANSACTION_" item such that
  // we only have one UNDO for it instead of N.
  // This should be easy but it's probably worth to create a wrapper something like:
  // asTransaction(item, function(d){
  //   d.lens('type').set('link')
  //   d.lens('data').set('www.example.com')
  // });
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
      // We also listen to any changes of the item itself
      item.withStateMachine(false, this.detectAndFilterUndos).slidingWindow(2,2).
           onValue( this.onModelChange.bind(this, item) );
    },

    detectAndFilterUndos: function(isUndo, ev) {
      // State changes:
      if(ev.hasValue() && (UNDO_FLAG in ev.value())) {
        // This could be optimized into an XOR I think
        if(!isUndo &&  ev.value()[UNDO_FLAG])
           return [true, []]; // Entering UNDO state, no item to emit
        if( isUndo && !ev.value()[UNDO_FLAG]) {
           return [false, []]; // Leaving UNDO state, no item to emit
           // BUG: We have to emit an item here if we undo so that if we change
           // something after an undo that the right element is in the "pipe"
           // (for the oldval of onModelChange)
           // Thoughts: Maybe use a statemachine after the slidingWindow()?
         }
      }
      // If no state changes: Just put it out:
      return [isUndo, isUndo ? [] : [ev]];
    },

    myPush: function(val) {
      this.state.history.push(val);
      this.setState();
    },

    deleteItem: function(which, isRedo) {
      // This is implementation specific but we could easily make this a callback props
      which.lens(UNDO_FLAG).set(true); // Start undo "transaction"
      which.lens('deleted').set(!isRedo);
      which.lens(UNDO_FLAG).set(false); // End undo "transaction"
    },

    onModelChange: function(item, ab) {
      // Push a function on the stack which reverts the changes of the model
      // var newV = ab[1], oldV = ab[0];
      this.myPush(function(isRedo) {
        item.lens(UNDO_FLAG).set(true); // Start undo "transaction"
        item.set(ab[isRedo+0]); // Set back to new/old value
        item.lens(UNDO_FLAG).set(false); // End undo "transaction"
      });
    },

    redo: function () {
      if(this.state.future.length == 0) return; // Would mess things up
      var f = this.state.future.pop();
      f(true); // Redo whatever needs to be redone
      this.state.history.push(f);
      this.setState(); // refresh UI
    },

    undo: function () {
      if(this.state.history.length == 0) return; // Would mess things up
      var f = this.state.history.pop();
      f(false); // Undo whatever needs to be undone
      this.state.future.push(f);
      this.setState(); // refresh UI
    },

    render: function () {
      return <div>
               <input type="button" value="Undo"
                 disabled={!this.state.history.length} onClick={this.undo} />
               <input type="button" value="Redo"
                 disabled={!this.state.future.length} onClick={this.redo} />
               <br />
               <span>{this.state.history.length} items to go back<br /></span>
               <span>{this.state.future.length} items to go forward<br /></span>
             </div>
    },
  });

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Main app hooks
  //////////////////////////////////////////////////////////////////////////////////////////////////
  var itemstream = new Bacon.Bus(); // Event stream
  // Not the UndoComp only get the bus and knows little about the actual data.
  // Only must know about "delete flag" which is the dual to a "new item"
  // All other changes are simply undone by rolling back any data to previous "state"
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

