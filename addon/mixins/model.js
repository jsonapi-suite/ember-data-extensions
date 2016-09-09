import Ember from 'ember';

const resetRelations = function(record) {
  Object.keys(record.get('__recordsJustSaved')).forEach((relationName) => {
    let relationRecords = record.get('__recordsJustSaved')[relationName];

    relationRecords.forEach((r) => {
      let shouldUnload = r.get('isNew') || r.get('markedForDestruction');
      if (shouldUnload) {
        r.unloadRecord();
      } else if (r.get('markedForDeletion')) {
        record.get(relationName).removeObject(r);
        r.set('markedForDeletion', false);
      }
    });
  });
  record.set('__recordsJustSaved', []);
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

  jsonapiType() {
    return this.store
      .adapterFor(this.constructor.modelName)
      .pathForType(this.constructor.modelName);
  },

  // Blank out all relations after saving
  // We will use the server response includes to 'reset'
  // these relations
  save(options = {}) {
    defaultOptions(options);
    let promise = this._super(...arguments);
    promise.then(resetRelations);
    return promise;
  }
});
