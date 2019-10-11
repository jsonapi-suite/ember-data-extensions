import config from './config/environment';
import EmberRouter from '@ember/routing/router';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('new-post', { path: '/' });
  this.route('edit-post', { path: '/posts/:post_id/edit' });
  this.route('post', { path: '/posts/:post_id' });
});

export default Router;
