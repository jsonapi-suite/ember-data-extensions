import Ember from 'ember';

export default Ember.Route.extend({
  model(params) {
    return this.store.findRecord('post', params.postId, {
      reload: true,
      include: 'author,tags'
    });
  }
});
