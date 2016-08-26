import Ember from 'ember';

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
const recordFromJson = function(db, data, callback) {
  let attributes = data.attributes || {};

  if (data.id) {
    let record = db[data.type].find(data.id);
    record.update(attributes);
    callback(record);
    return;
  }

  let notNull = false;
  Object.keys(attributes).forEach((key) => {
    if (Ember.isPresent(attributes[key])) {
      notNull = true;
    }
  });

  if (notNull) {
    callback(db[data.type].new(attributes));
  }
};

const mapBy = function(array, attribute) {
  return Ember.A(array).mapBy(attribute);
};

const contains = function(array, element) {
  return Ember.A(array).contains(element);
};

const hasRecord = function(array, record) {
  if (record.id) {
    let ids = mapBy(array, 'id');
    return contains(ids, record.id);
  } else {
    return false;
  }
};

const markedForRemoval= function(record) {
  return record._delete || record._destroy;
};

const buildOneToMany = function(db, relationData, originalRecords) {
  relationData.forEach((data) => {
    recordFromJson(db, data, (record) => {
      if (markedForRemoval(record)) {
        let index = originalRecords.indexOf(record);
        originalRecords.splice(index, 1);
      } else {
        if (!hasRecord(originalRecords, record)) {
          originalRecords.push(record);
        }
      }
    });
  });
  return originalRecords;
};

const processRelations = function(record, db, request) {
  iterateRelations(request, (relationName, relationData) => {
    if (Array.isArray(relationData)) {
      let originals = record[relationName].models;
      record[relationName] = buildOneToMany(db, relationData, originals);
    } else {
      recordFromJson(db, relationData, (relationRecord) => {
        record[relationName] = relationRecord;
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
}
