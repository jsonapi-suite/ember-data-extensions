import {
  create,
  visitable,
  fillable,
  clickable,
  collection,
  value
} from 'ember-cli-page-object';

export default create({
  visit: visitable('/'),
  submit: clickable('button[type="submit"]'),
  addTag: clickable('.add-tag'),

  title: {
    scope: '.title',
    fillIn: fillable('input'),
    val: value('input')
  },

  authorName: {
    scope: '.author-name',
    fillIn: fillable('input'),
    val: value('input')
  },

  tags: collection({
    itemScope: '.tags .tag',

    item: {
      name: value('input'),
      setName: fillable('input'),
      remove: clickable('a')
    }
  })
});
