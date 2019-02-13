import Mixin from '@ember/object/mixin';
import { computed } from '@ember/object';
import EmberObject from '@ember/object';
import { A } from '@ember/array';
import { defineProperty } from '@ember/object';
import { guidFor } from '@ember/object/internals';

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

export default Mixin.create({
  hasDirtyAttributes: computed('currentState.isDirty', 'markedForDestruction', 'markedForDeletion', function() {
    let original = this._super(...arguments);
    return original || this.get('markedForDestruction') || this.get('markedForDeletion');
  }),

  markedForDeletion: computed('_markedForDeletion', function() {
    return this.get('_markedForDeletion') || false;
  }),

  markedForDestruction: computed('_markedForDestruction', function() {
    return this.get('_markedForDestruction') || false;
  }),

  markForDeletion() {
    this.set('_markedForDeletion', true);
  },

  unmarkForDeletion() {
    this.set('_markedForDeletion', false);
  },

  markForDestruction() {
    this.set('_markedForDestruction', true);
  },

  unmarkForDestruction() {
    this.set('_markedForDestruction', false);
  },

  markManyToManyDeletion(relation, model) {
    let deletedRelations = this.get('_manyToManyDeleted');
    if(!deletedRelations) {
      this.set('_manyToManyDeleted', EmberObject.create());
      deletedRelations = this.get('_manyToManyDeleted');
    }

    if(!deletedRelations.get(relation)) {
      deletedRelations.set(relation, A());
      defineProperty(
        this,
        `manyToManyDeleted${relation}`, computed.readOnly(`_manyToManyDeleted.${relation}`)
      );
    }

    if(!deletedRelations.get(relation).includes(model)) {
      deletedRelations.get(relation).pushObject(model);
    }
  },

  manyToManyMarkedForDeletionModels(relation) {
    const relationModels = this.get('_manyToManyDeleted') &&
      this.get(`_manyToManyDeleted.${relation}`);
    return relationModels && relationModels.toArray() || [];
  },

  unmarkManyToManyDeletion(relation, model) {
    return this.get('_manyToManyDeleted') &&
            this.get(`_manyToManyDeleted.${relation}`) &&
            this.get(`_manyToManyDeleted.${relation}`).removeObject(model);
  },

  tempId() {
    if (!this._tempId) {
      this._tempId = guidFor(this);
    }
    return this._tempId;
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
    if (options.resetRelations === true) {
      return promise.then(resetRelations);
    }
    return promise;
  }
});
