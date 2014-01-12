/**
 * @jsx React.DOM
 */
/*jshint quotmark: false */
/*jshint white: false */
/*jshint trailing: false */
/*jshint newcap: false */
/*global React, Utils */
(function (window) {
  'use strict';

  var ESCAPE_KEY = 27;
  var ENTER_KEY = 13;

  window.TodoItem = React.createClass({
    getInitialState: function () {
      return {
        editing: false, // not in edit mode upon creating a todo note
        editText: this.props.todo.get().title
      };
    },

    handleSubmit: function () {
      var val = this.state.editText.trim();
      if (val) {
        this.setState({editText: val});
        this.setState({editing: false});
        this.props.todo.lens('title').set(val);
      } else {
        this.props.destroy();
      }
      return false;
    },

    handleEdit: function () {
      // react optimizes renders by batching them. This means you can't call
      // parent's `onEdit` (which in this case triggeres a re-render), and
      // immediately manipulate the DOM as if the rendering's over. Put it as a
      // callback. Refer to app.js' `edit` method
      var node = this.refs.editField.getDOMNode();
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
      this.setState({editText: this.props.todo.get().title});
      this.edit();
    },

    handleKeyDown: function (event) {
      if (event.keyCode === ESCAPE_KEY) {
        // Revert to what's in the model
        this.setState({editText: this.props.todo.get().title});
      } else if (event.keyCode === ENTER_KEY) {
        this.handleSubmit();
      }
    },

    toggleCompleted: function() {
      this.props.todo.lens('completed').modify(function(e){return !e});
    },

    destroy: function() {
      this.props.todo.lens('deleted').set(true);
    },

    edit: function () {
      this.setState({editing: true});
    },

    save: function (text) {
      this.props.todo.lens('title').set(text);
      this.setState({editing: false});
    },

    cancel: function () {
      this.setState({editing: false});
    },

    handleChange: function (event) {
      this.setState({editText: event.target.value});
    },

    render: function () {
      return (
        <li className={React.addons.classSet({
          completed: this.props.todo.get().completed,
          editing: this.state.editing
        })}>
          <div className="view">
            <input
              className="toggle"
              type="checkbox"
              checked={this.props.todo.get().completed ? 'checked' : null}
              onChange={this.toggleCompleted}
            />
            <label onDoubleClick={this.handleEdit}>
              {this.props.todo.get().title}
            </label>
            <button className="destroy" onClick={this.destroy} />
          </div>
          <input
            ref="editField"
            className="edit"
            value={this.state.editText}
            onBlur={this.handleSubmit}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyDown}
          />
        </li>
      );
    }
  });
})(window);
