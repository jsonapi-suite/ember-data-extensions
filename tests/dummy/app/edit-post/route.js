import PostFormMixin from 'dummy/mixins/post-form-route';
import Route from '@ember/routing/route';

export default Route.extend(PostFormMixin, {
  model(params) {
    return this.store.findRecord('post', params.post_id, {
      include: 'tags,author'
    });
  }
});
