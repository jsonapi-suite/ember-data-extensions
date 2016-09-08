import Ember from 'ember';

// This is for reference in our post-save promise
// We need to unload these records after save, otherwise
// we will be left with 2 of the same object - one persisted
// and one not.
// This is only required for hasMany's
let savedRecords = [];

const iterateRelations = function(record, relations, callback) {
  Object.keys(relations).forEach((relationName) => {
    let subRelations = relations[relationName];

    let kind = record.relationshipFor(relationName).kind;
    let relatedRecord = record.get(relationName);
    relatedRecord = relatedRecord.get('content');

    if (relatedRecord) {
      callback(relationName, kind, relatedRecord, subRelations);
    }
  });
};

const isPresentObject = function(val) {
  return val && Object.keys(val).length > 0;
};

const attributesFor = function(record) {
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

  if (record.get('markedForDeletion')) {
    attrs = { _delete: true };
  }

  if (record.get('markedForDestruction')) {
    attrs = { _destroy: true };
  }

  return attrs;
};

const jsonapiType = function(record) {
  return record.store
    .adapterFor(record.constructor.modelName)
    .pathForType(record.constructor.modelName);
};

const jsonapiPayload = function(record) {
  let attributes = attributesFor(record);

  let payload = { type: jsonapiType(record) };

  if (isPresentObject(attributes)) {
    payload.attributes = attributes;
  }

  if (record.id) {
    payload.id = record.id;
  }

  return payload;
};

const hasManyData = function(relatedRecords, subRelations) {
  let payloads = [];
  relatedRecords.forEach((relatedRecord) => {
    let payload = jsonapiPayload(relatedRecord);
    processRelationships(subRelations, payload, relatedRecord);
    payloads.push(payload);
    savedRecords.push(relatedRecord);
  });
  return { data: payloads };
};

const belongsToData = function(relatedRecord, subRelations) {
  let payload = jsonapiPayload(relatedRecord);
  processRelationships(subRelations, payload, relatedRecord);
  return { data: payload };
};

const processRelationship = function(kind, relationData, subRelations, callback) {
  let payload = null;

  if (kind === 'hasMany') {
    payload = hasManyData(relationData, subRelations);
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

    iterateRelations(record, relationshipHash, (name, kind, related, subRelations) => {
      processRelationship(kind, related, subRelations, (payload) => {
        jsonData.relationships[name] = payload;
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

    let relationships = relationshipsDirective(adapterOptions.relationships);
    processRelationships(relationships, json.data, snapshot.record);
    snapshot.record.set('__recordsJustSaved', savedRecords);
    console.log('serialized', json);
    return json;
  }
});
