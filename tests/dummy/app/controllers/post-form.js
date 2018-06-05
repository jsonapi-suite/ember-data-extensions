import Ember from 'ember';

export default Ember.Controller.extend({
  tags: Ember.computed.filterBy('model.tags', 'markedForDeletion', false)
});
