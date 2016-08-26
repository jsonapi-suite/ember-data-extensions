import Ember from 'ember';

const resetRelations = function(record) {
  record.eachRelationship((relationName, meta) => {
    if (meta.kind === 'hasMany') {
      record.set(relationName, Ember.A());
    } else {
      record.set(relationName, null);
    }
  });
};

const defaultOptions = function(options) {
  if (options.resetRelations !== false) {
    options.resetRelations = true;
  }
};

export default Ember.Mixin.create({
  hasDirtyAttributes: Ember.computed('currentState.isDirty', 'markedForDestruction', 'markedForDeletion', function() {
    let original = this._super(...arguments);
    return original || this.get('markedForDestruction') || this.get('markedForDeletion');
  }),

  markedForDeletion: Ember.computed('_markedForDeletion', function() {
    return this.get('_markedForDeletion') || false;
  }),

  markedForDestruction: Ember.computed('_markedForDestruction', function() {
    return this.get('_markedForDestruction') || false;
  }),

  markForDeletion() {
    this.set('_markedForDeletion', true);
  },

  markForDestruction() {
    this.set('_markedForDestruction', true);
  },

  // Blank out all relations after saving
  // We will use the server response includes to 'reset'
  // these relations
  save(options = {}) {
    defaultOptions(options);
    let promise = this._super(...arguments);

    if (options.resetRelations) {
      promise.then(resetRelations);
    }

    return promise;
  }
});
