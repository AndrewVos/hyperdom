var plastiq = require('.');
var h = plastiq.html;
var bind = plastiq.bind;

function render(model) {
  return h('div',
    h('section#todoapp',
      h('header#header',
        h('h1', 'todos'),
        h('input#new-todo', {
          placeholder: 'What needs to be done?',
          autofocus: true,
          onkeydown: function (ev) {
            if (ev.keyCode == 13) {
              model.todos.push({text: ev.target.value});
              ev.target.value = '';
            }
          }
        })
      ),
      model.todos.length > 0? [
        h('section#main',
          h('input#toggle-all', {
            type: 'checkbox',
            model: function (done) {
              if (done !== undefined) {
                model.completeAllItems(done);
              } else {
                return model.itemsAllDone();
              }
            }
          }),
          h('label', {'htmlFor': 'toggle-all'}, 'Mark all as complete'),
          h('ul#todo-list', model.filteredTodos().map(function (todo, index) {
            return renderTodo(model, todo);
          }))
        ),
        h('footer#footer',
          h('span#todo-count', h('strong', model.itemsLeft()), ' item' + (model.itemsLeft() == 1? '': 's') + ' left'),
          h('ul#filters',
            renderFilter(model, allFilter, 'All'),
            renderFilter(model, activeFilter, 'Active'),
            renderFilter(model, completedFilter, 'Completed')
          )
        )
      ]: undefined
    ),
    h('footer#info',
      h('p', 'blah blah')
    )
  );
}

function renderFilter(model, filter, name) {
  return h('li', h('a', {
    href: '#',
    onclick: function () {
      model.filter = filter;
      return false;
    },
    className: { selected: model.filter == filter }
  }, name))
}

function renderTodo(model, todo) {
  return h('li', {className: {completed: todo.done}},
    h('div.view',
      h('input.toggle', {type: 'checkbox', model: bind(todo, 'done')}),
      h('label', todo.text),
      h('button.destroy', {
        onclick: function () {
          model.deleteTodo(todo);
        }
      })
    )
  );
}

function allFilter(todos) {
  return todos;
}

function activeFilter(todos) {
  return todos.filter(function (todo) {
    return !todo.done;
  });
}

function completedFilter(todos) {
  return todos.filter(function (todo) {
    return todo.done;
  });
}

plastiq.attach(document.body, render, {
  todos: [
    {text: 'one'}
  ],
  filter: allFilter,

  deleteTodo: function (todo) {
    console.log('deleting todo');
    var index = this.todos.indexOf(todo);

    if (index >= 0) {
      this.todos.splice(index, 1);
    }
  },

  filteredTodos: function () {
    return this.filter(this.todos);
  },

  itemsLeft: function () {
    return activeFilter(this.todos).length;
  },

  itemsAllDone: function () {
    return completedFilter(this.todos).length == this.todos.length;
  },

  completeAllItems: function (done) {
    this.todos.forEach(function (todo) {
      todo.done = done;
    });
  }
});