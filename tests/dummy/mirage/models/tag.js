import { Model, belongsTo, hasMany } from 'ember-cli-mirage';

export default Model.extend({
  post: belongsTo(),
  descriptions: hasMany()
});
