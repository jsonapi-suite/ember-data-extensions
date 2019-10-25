import Mixin from '@ember/object/mixin';
import { copy } from '@ember/object/internals';
import { merge } from '@ember/polyfills';

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
    let manyToManyDeleted = record.manyToManyMarkedForDeletionModels(relationName);
    let isManyToOneDelete = record.markedForManyToOneDeletion(relationName);

    if (metadata.options.async !== false) {
      relatedRecord = relatedRecord.get('content');
    }

    if (relatedRecord) {
      callback(relationName, kind, relatedRecord, subRelations, manyToManyDeleted, isManyToOneDelete);
    }
  });
};

const isPresentObject = function(val) {
  return val && Object.keys(val).length > 0;
};

const attributesFor = function(record) {
  let attrs = {};

  let changes = record.changedAttributes();
  let serializer = record.store.serializerFor(record.constructor.modelName);

  record.eachAttribute((name/* meta */) => {
    let keyName = serializer.keyForAttribute(name);

    if (record.get('isNew') || changes[name]) {
      let value = record.get(name);

      if (value !== undefined) {
        attrs[keyName] = record.get(name);
      }
    }
  });

  return attrs;
};

const jsonapiPayload = function(record, relationshipMarkedForDeletion) {
  let attributes = attributesFor(record);

  let payload = { type: record.jsonapiType() };

  if (isPresentObject(attributes)) {
    payload.attributes = attributes;
  }

  if (record.get('isNew')) {
    payload['temp-id'] = record.tempId();
    payload['method'] = 'create';
  }
  else if (record.get('markedForDestruction')) {
    payload['method'] = 'destroy';
  }
  else if (record.get('markedForDeletion') || relationshipMarkedForDeletion) {
    payload['method'] = 'disassociate';
  }
  else if (record.get('currentState.isDirty')) {
    payload['method'] = 'update';
  }

  if (record.id) {
    payload.id = record.id;
  }

  return payload;
};

const payloadForInclude = function(payload) {
  let payloadCopy = copy(payload, true);
  delete(payloadCopy.method);

  return payloadCopy;
};

const payloadForRelationship = function(payload) {
  let payloadCopy = copy(payload, true);
  delete(payloadCopy.attributes);
  delete(payloadCopy.relationships);

  return payloadCopy;
};

const addToIncludes = function(payload, includedRecords) {
  let includedPayload = payloadForInclude(payload);

  if (!includedPayload.attributes && !isPresentObject(includedPayload.relationships)) {
    return;
  }

  const alreadyIncluded = includedRecords.find((includedRecord) =>
    includedPayload['type'] === includedRecord['type'] &&
    ((includedPayload['temp-id'] && includedPayload['temp-id'] === includedRecord['temp-id']) ||
      (includedPayload['id'] && includedPayload['id'] === includedRecord['id']))
  ) !== undefined;

  if (!alreadyIncluded) {
    includedRecords.push(includedPayload);
  }
};

const hasManyData = function(relationName, relatedRecords, subRelations, manyToManyDeleted, includedRecords) {
  let payloads = [];
  savedRecords[relationName] = [];

  relatedRecords.forEach((relatedRecord) => {
    let payload = jsonapiPayload(relatedRecord, manyToManyDeleted && manyToManyDeleted.includes(relatedRecord));
    processRelationships(subRelations, payload, relatedRecord, includedRecords);
    addToIncludes(payload, includedRecords);

    payloads.push(payloadForRelationship(payload));
    savedRecords[relationName].push(relatedRecord);
  });
  return { data: payloads };
};

const belongsToData = function(relatedRecord, subRelations, isManyToOneDelete, includedRecords) {
  let payload = jsonapiPayload(relatedRecord, isManyToOneDelete);
  processRelationships(subRelations, payload, relatedRecord, includedRecords);
  addToIncludes(payload, includedRecords);

  return { data: payloadForRelationship(payload) };
};

const processRelationship = function(name, kind, relationData, subRelations, manyToManyDeleted, isManyToOneDelete, includedRecords, callback) {
  let payload = null;

  if (kind === 'hasMany') {
    payload = hasManyData(name, relationData, subRelations, manyToManyDeleted, includedRecords);
  } else {
    payload = belongsToData(relationData, subRelations, isManyToOneDelete, includedRecords);
  }

  if (payload && payload.data) {
    callback(payload);
  }
};

const processRelationships = function(relationshipHash, jsonData, record, includedRecords) {
  if (isPresentObject(relationshipHash)) {
    jsonData.relationships = {};

    iterateRelations(record, relationshipHash, (name, kind, related, subRelations, manyToManyDeleted, isManyToOneDelete) => {
      processRelationship(name, kind, related, subRelations, manyToManyDeleted, isManyToOneDelete, includedRecords, (payload) => {
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
        merge(directive, relationshipsDirective(key));
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

export default Mixin.create({
  serialize(snapshot/*, options */) {
    savedRecords = [];

    let json = this._super(...arguments);
    let includedRecords = [];

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
      processRelationships(relationships, json.data, snapshot.record, includedRecords);
      if (includedRecords && includedRecords.length > 0) {
        json.included = includedRecords;
      }
      snapshot.record.set('__recordsJustSaved', savedRecords);
    }

    return json;
  }
});
