import Ember from 'ember';
import PostFormMixin from 'dummy/mixins/post-form-route';

export default Ember.Route.extend(PostFormMixin, {
  model() {
    return this.store.createRecord('post', {
      author: this.store.createRecord('author')
    });
  }
});
