import { A } from '@ember/array';
import { isPresent } from '@ember/utils';

const attributes = function(request) {
  return JSON.parse(request.requestBody).data.attributes || {};
};

const iterateRelations = function(request, callback) {
  let relationships = JSON.parse(request.requestBody).data.relationships || {};
  Object.keys(relationships).forEach((relationName) => {
    let data = relationships[relationName].data;
    callback(relationName, data);
  });
};

// Omit anything that has all blank attributes
// Akin to rails' accepts_nested_attributes_for :foos, reject_if: :all_blank
const recordFromJson = function(db, data, includedData, callback) {

  let found;

  if (data['temp-id']) {
    found = includedData.filter(item => (item['temp-id'] === data['temp-id']))[0];
  }
  else {
    found = includedData.filter(item => (item.id === data.id))[0];
  }

  let attributes = found ? found.attributes : {};

  if (data.id) {
    let record = db[data.type].find(data.id);

    if (data['method'] === 'update') {
      record.update(attributes);
    }
    callback(record);
    return;
  }

  let notNull = false;
  Object.keys(attributes).forEach((key) => {
    if (isPresent(attributes[key])) {
      notNull = true;
    }
  });

  if (notNull) {
    callback(db[data.type].new(attributes));
  }
};

const mapBy = function(array, attribute) {
  return A(array).mapBy(attribute);
};

const contains = function(array, element) {
  return A(array).includes(element);
};

const hasRecord = function(array, record) {
  if (record.id) {
    let ids = mapBy(array, 'id');
    return contains(ids, record.id);
  } else {
    return false;
  }
};

const buildOneToMany = function(db, relationData, includedRecords, originalRecords) {
  relationData.forEach((data) => {
    let method = data.method;

    recordFromJson(db, data, includedRecords, (record) => {
      if (method === 'disassociate' || method === 'destroy') {
        let index = originalRecords.indexOf(record);
        originalRecords.splice(index, 1);
      }
      else {
        if (!hasRecord(originalRecords, record)) {
          originalRecords.push(record);
        }
      }
    });
  });
  return originalRecords;
};

const processRelations = function(record, db, request) {
  let includedRecords = JSON.parse(request.requestBody).included || [];

  iterateRelations(request, (relationName, relationData) => {
    if (Array.isArray(relationData)) {
      let originals = record[relationName].models;
      record[relationName] = buildOneToMany(db, relationData, includedRecords, originals);
    } else {
      recordFromJson(db, relationData, includedRecords, (relationRecord, remove) => {
        record[relationName] = relationRecord;
        if (remove) {
          delete record[relationName];
        }
      });
    }
  });
  record.save();
};

export default function() {
  this.logging = true;

  this.post('/posts', function(db, request) {
    let post = db.posts.create(attributes(request));
    processRelations(post, db, request);

    return post;
  });

  this.patch('/posts/:id', function(db, request) {
    let post = db.posts.find(request.params.id);
    processRelations(post, db, request);
    return post;
  });

  this.get('/posts/:id', function(db, request) {
    let post = db.posts.find(request.params.id);
    return post;
  });

  this.get('/authors/:id');
  this.get('/tags/:id');
  this.get('/tags');
}
