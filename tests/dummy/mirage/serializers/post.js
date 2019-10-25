import ApplicationSerializer from './application';

export default ApplicationSerializer.extend({
  init() {
    this._super(...arguments);
    this.set('include', ['tags', 'author']);
  }
});
