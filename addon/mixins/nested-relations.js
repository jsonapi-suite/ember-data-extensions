import Ember from 'ember';

// This is for reference in our post-save promise
// We need to unload these records after save, otherwise
// we will be left with 2 of the same object - one persisted
// and one not.
// This is only required for hasMany's
let savedRecords = {};

const iterateRelations = function(record, relations, callback) {
  Object.keys(relations).forEach((relationName) => {
    let subRelations = relations[relationName];

    let metadata          = record.relationshipFor(relationName);
    let kind              = metadata.kind;
    let relatedRecord     = record.get(relationName);
    let manyToManyDeleted = record.manyToManyMarkedForDeletion(relationName);


    if (metadata.options.async !== false) {
      relatedRecord = relatedRecord.get('content');
    }

    if (relatedRecord) {
      callback(relationName, kind, relatedRecord, subRelations, manyToManyDeleted);
    }
  });
};

const isPresentObject = function(val) {
  return val && Object.keys(val).length > 0;
};

const attributesFor = function(record, isManyToManyDelete) {
  let attrs = {};

  let changes = record.changedAttributes();
  record.eachAttribute((name/* meta */) => {
    if (record.get('isNew') || changes[name]) {
      let value = record.get(name);

      if (value !== undefined) {
        attrs[name] = record.get(name);
      }
    }
  });

  if (record.get('markedForDeletion') || isManyToManyDelete) {
    attrs = { _delete: true };
  }

  if (!record.get('isNew') && record.get('markedForDestruction')) {
    attrs = { _destroy: true };
  }

  return attrs;
};

const jsonapiPayload = function(record, isManyToManyDelete) {
  let attributes = attributesFor(record, isManyToManyDelete);

  let payload = { type: record.jsonapiType() };

  if (isPresentObject(attributes)) {
    payload.attributes = attributes;
  }

  if (record.id) {
    payload.id = record.id;
  }

  return payload;
};

const hasManyData = function(relationName, relatedRecords, subRelations, manyToManyDeleted) {
  let payloads = [];
  savedRecords[relationName] = [];
  relatedRecords.forEach((relatedRecord) => {
    let payload = jsonapiPayload(relatedRecord, manyToManyDeleted && manyToManyDeleted.includes(relatedRecord));
    processRelationships(subRelations, payload, relatedRecord);
    payloads.push(payload);
    savedRecords[relationName].push(relatedRecord);
  });
  return { data: payloads };
};

const belongsToData = function(relatedRecord, subRelations) {
  let payload = jsonapiPayload(relatedRecord);
  processRelationships(subRelations, payload, relatedRecord);
  return { data: payload };
};

const processRelationship = function(name, kind, relationData, subRelations, manyToManyDeleted, callback) {
  let payload = null;

  if (kind === 'hasMany') {
    payload = hasManyData(name, relationData, subRelations, manyToManyDeleted);
  } else {
    payload = belongsToData(relationData, subRelations);
  }

  if (payload && payload.data) {
    callback(payload);
  }
};

const processRelationships = function(relationshipHash, jsonData, record) {
  if (isPresentObject(relationshipHash)) {
    jsonData.relationships = {};

    iterateRelations(record, relationshipHash, (name, kind, related, subRelations, manyToManyDeleted) => {
      processRelationship(name, kind, related, subRelations, manyToManyDeleted, (payload) => {
        let serializer = record.store.serializerFor(record.constructor.modelName);
        let serializedName = serializer.keyForRelationship(name);
        jsonData.relationships[serializedName] = payload;
      });
    });
  }
};

const relationshipsDirective = function(value) {
  let directive = {};

  if (value) {
    if (typeof(value) === 'string') {
      directive[value] = {};
    } else if(Array.isArray(value)) {
      value.forEach((key) => {
        Ember.merge(directive, relationshipsDirective(key));
      });
    } else {
      Object.keys(value).forEach((key) => {
        directive[key] = relationshipsDirective(value[key]);
      });
    }
  } else {
    return {};
  }

  return directive;
};

export default Ember.Mixin.create({
  serialize(snapshot/*, options */) {
    savedRecords = [];
    let json = this._super(...arguments);

    if (snapshot.record.get('emberDataExtensions') !== false) {
      delete(json.data.relationships);
      delete(json.data.attributes);

      let adapterOptions = snapshot.adapterOptions || {};

      let attributes = attributesFor(snapshot.record);
      if (isPresentObject(attributes)) {
        json.data.attributes = attributes;
      }

      if (snapshot.record.id) {
        json.data.id = snapshot.record.id.toString();
      }

      if (adapterOptions.attributes === false) {
        delete(json.data.attributes);
      }

      if (adapterOptions.attributes) {
        if (!json.data.attributes) {
          json.data.attributes = {};
        }

        Object.keys(adapterOptions.attributes).forEach((k) => {
          json.data.attributes[k] = adapterOptions.attributes[k];
        });
      }

      let relationships = relationshipsDirective(adapterOptions.relationships);
      processRelationships(relationships, json.data, snapshot.record);
      snapshot.record.set('__recordsJustSaved', savedRecords);
    }

    return json;
  }
});
