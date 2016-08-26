import Ember from 'ember';
import PostFormMixin from 'dummy/mixins/post-form-route';

export default Ember.Route.extend(PostFormMixin, {
  model(params) {
    return this.store.findRecord('post', params.postId, {
      include: 'tags,author'
    });
  }
});
