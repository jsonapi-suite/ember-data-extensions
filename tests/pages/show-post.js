import {
  create,
  visitable,
  text,
  clickable
} from 'ember-cli-page-object';

export default create({
  visit: visitable('/posts/:id'),
  title: text('.title span'),
  authorName: text('.author-name span'),

  tagList: text('.tags span'),

  edit: clickable('.edit')
});
