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
  authorId: text('.author-id span'),

  tagList: text('.tag-names span'),
  tagIds: text('.tag-ids span'),

  edit: clickable('.edit')
});
