import PostFormMixin from 'dummy/mixins/post-form-route';
import Route from '@ember/routing/route';

export default Route.extend(PostFormMixin, {
  model() {
    return this.store.createRecord('post', {
      author: this.store.createRecord('author')
    });
  }
});
