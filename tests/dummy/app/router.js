import Ember from 'ember';
import config from './config/environment';

const Router = Ember.Router.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('new-post', { path: '/' });
  this.route('edit-post', { path: '/posts/:postId/edit' });
  this.route('post', { path: '/posts/:postId' });
});

export default Router;
