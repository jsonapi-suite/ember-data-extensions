import Ember from 'ember';
import DS from 'ember-data';
import moduleForAcceptance from '../../../tests/helpers/module-for-acceptance';
import NestedRelationsMixin from 'ember-data-extensions/mixins/nested-relations';
import ModelMixin from 'ember-data-extensions/mixins/model';
import getOwner from '../../../tests/helpers/get-owner';

QUnit.dump.maxDepth = 999999999;

let serializer = null;
let store = null;

const State = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string')
});

const Author = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string'),
  state: DS.belongsTo()
});

const User = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string')
});

const Tag = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string'),
  creator: DS.belongsTo('user')
});

const Genre = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string')
});

const Post = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  title: DS.attr('string'),
  publishedDate: DS.attr('date'),
  genre: DS.belongsTo(),
  author: DS.belongsTo(),
  asyncFalseAuthor: DS.belongsTo('author', { async: false }),
  tags: DS.hasMany()
});

let TestSerializer = DS.JSONAPISerializer.extend(NestedRelationsMixin);
let TestStore = DS.Store.extend();

moduleForAcceptance('Unit | Mixin | nested-relations', {
  beforeEach() {
    getOwner(this).register('service:store', TestStore);
    store = getOwner(this).lookup('service:store');

    getOwner(this).register('test-container:test-serializer', TestSerializer);
    serializer = getOwner(this).lookup('test-container:test-serializer');
    serializer.store = store;

    getOwner(this).register('model:post', Post);
    getOwner(this).register('model:tag', Tag);
    getOwner(this).register('model:author', Author);
    getOwner(this).register('model:genre', Genre);
    getOwner(this).register('model:state', State);
    getOwner(this).register('model:user', User);

    Ember.run.begin();
  },

  afterEach() {
    Ember.run.end();
  }
});

const serialize = function(record, adapterOptions) {
  let snapshot = record._internalModel.createSnapshot({
    adapterOptions: adapterOptions
  });

  let json = serializer.serialize(snapshot, {});
  return json;
};

const seedPostWithAuthor = function() {
  store.pushPayload({
    data: {
      type: 'posts',
      id: 1,
      relationships: {
        author: {
          data: {
            type: 'authors',
            id: 2
          }
        }
      }
    },
    included: [
      {
        type: 'authors',
        id: 2,
        attributes: { name: 'Joe Author' }
      }
    ]
  });
};

const seedPostWithTags = function() {
  store.pushPayload({
    data: {
      type: 'posts',
      id: 1,
      relationships: {
        tags: {
          data: [
            { type: 'tags', id: 2 },
            { type: 'tags', id: 3 },
            { type: 'tags', id: 4 }
          ]
        }
      }
    },
    included: [
      {
        type: 'tags',
        id: 2,
        attributes: { name: 'tag1' }
      },
      {
        type: 'tags',
        id: 3,
        attributes: { name: 'tag2' }
      },
      {
        type: 'tags',
        id: 4,
        attributes: { name: 'tag3' }
      }
    ]
  });
};

test('it serializes basic attributes correctly', function(assert) {
  let post = store.createRecord('post', { title: 'test post' });
  let json = serialize(post, {});

  let expectedJSON = {
    data: {
      type: 'posts',
      attributes: {
        title: 'test post'
      }
    }
  };

  assert.deepEqual(json, expectedJSON, 'has correct json');
});

test('it respects custom keyForAttribute settings in serializer', function(assert) {
  let date = new Date();
  let post = store.createRecord('post', { publishedDate: date });
  let json = serialize(post, {});

  let expectedJSON = {
    data: {
      type: 'posts',
      attributes: {
        published_date: date // serializer transforms to underscores
      }
    }
  };

  assert.deepEqual(json, expectedJSON, 'has correct json');
});

test('it does not serialize undefined attributes', function(assert) {
  let post = store.createRecord('post');
  let json = serialize(post, {});

  let expectedJSON = { data: { type: 'posts' } };
  assert.deepEqual(json, expectedJSON, 'has correct json');
});

test('it does not serialize non-dirty attributes', function(assert) {
  store.pushPayload({
    data: {
      type: 'posts',
      id: '1',
      attributes: { title: 'test title' }
    }
  });
  let post = store.peekRecord('post', 1);
  let json = serialize(post, {});
  let expectedJSON = {
    data: {
      type: 'posts',
      id: '1'
    }
  };
  assert.deepEqual(json, expectedJSON);
});

test('excluding attributes', function(assert) {
  let post = store.createRecord('post', { title: 'test post' });
  let json = serialize(post, { attributes: false });
  assert.notOk(json.data.hasOwnProperty('attributes'), 'attributes not included');
  json = serialize(post, {});
  assert.deepEqual(json.data.attributes, { title: 'test post' }, 'attributes included');
});

test('it serializes one-to-one correctly', function(assert) {
  let post = store.createRecord('post', {
    author: store.createRecord('author', { name: 'Joe Author' })
  });
  let json = serialize(post, { attributes: false, relationships: 'author' });
  let expectedJSON = {
    data: {
      type: 'posts',
      relationships: {
        author: {
          data: {
            type: 'authors',
            attributes: {
              name: 'Joe Author'
            }
          }
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON, 'has correct json');
});

test('it serializes async: false relationships correctly', function(assert) {
  let post = store.createRecord('post', {
    asyncFalseAuthor: store.createRecord('author', { name: 'Joe Author' })
  });
  let json = serialize(post, { attributes: false, relationships: 'asyncFalseAuthor' });
  let expectedJSON = {
    data: {
      type: 'posts',
      relationships: {
        'async-false-author': {
          data: {
            type: 'authors',
            attributes: {
              name: 'Joe Author'
            }
          }
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON, 'has correct json');
});

test('it serializes has one marked for deletion correctly', function(assert) {
  seedPostWithAuthor();

  let post = store.peekRecord('post', 1);
  post.get('author').set('markedForDeletion', true);

  let json = serialize(post, { attributes: false, relationships: 'author' });
  let expectedJSON = {
    data: {
      id: '1',
      type: 'posts',
      relationships: {
        author: {
          data: {
            id: '2',
            type: 'authors',
            attributes: {
              _delete: true
            }
          }
        }
      }
    }
  };

  assert.deepEqual(json, expectedJSON, 'has correct json');
});

test('it serializes has one marked for destruction correctly', function(assert) {
  seedPostWithAuthor();

  let post = store.peekRecord('post', 1);
  post.get('author').set('markedForDestruction', true);

  let json = serialize(post, { attributes: false, relationships: 'author' });
  let expectedJSON = {
    data: {
      id: '1',
      type: 'posts',
      relationships: {
        author: {
          data: {
            id: '2',
            type: 'authors',
            attributes: {
              _destroy: true
            }
          }
        }
      }
    }
  };

  assert.deepEqual(json, expectedJSON, 'has correct json');
});

test('it serializes one-to-many correctly', function(assert) {
  let post = store.createRecord('post', {
    tags: [
      store.createRecord('tag', { name: 'tag1' })
    ]
  });

  let json = serialize(post, { attributes: false, relationships: 'tags' });

  let expectedJSON = {
    data: {
      type: 'posts',
      relationships: {
        tags: {
          data: [
            {
              type: 'tags',
              attributes: {
                name: 'tag1'
              }
            }
          ]
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON, 'has correct json');
});

// note tag 2 does not pass attributes
test('one-to-many deletion/destruction', function(assert) {
  seedPostWithTags();
  let post = store.peekRecord('post', 1);
  post.get('tags').objectAt(1).set('markedForDeletion', true);
  post.get('tags').objectAt(2).set('markedForDestruction', true);
  let json = serialize(post, { attributes: false, relationships: 'tags' });
  let expectedJSON = {
    data: {
      id: '1',
      type: 'posts',
      relationships: {
        tags: {
          data: [
            { type: 'tags', id: '2' },
            { type: 'tags', id: '3', attributes: { _delete: true } },
            { type: 'tags', id: '4', attributes: { _destroy: true } },
          ]
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON, 'it has correct json');
});

test('relationship specified but not present', function(assert) {
  let post = store.createRecord('post');
  let json = serialize(post, { attributes: false, relationships: 'author' });
  let expectedJSON = {
    data: {
      type: 'posts',
      relationships: {}
    }
  };
  assert.deepEqual(json, expectedJSON, 'it does not blow up');
});

test('does not serialize attributes of non-dirty relations', function(assert) {
  store.pushPayload({
    data: {
      id: '1',
      type: 'posts',
      relationships: {
        genre: {
          data: {
            type: 'genres',
            id: '88'
          }
        },
        author: {
          data: {
            type: 'authors',
            id: '99'
          }
        },
        tags: {
          data: [
            { id: '2', type: 'tags' },
            { id: '3', type: 'tags' }
          ]
        }
      }
    },
    included: [
      { type: 'tags',    id: '2',  attributes: { name: 'tag1' } },
      { type: 'tags',    id: '3',  attributes: { name: 'tag2' } },
      { type: 'authors', id: '99', attributes: { name: 'Joe Author' } },
      { type: 'genres',  id: '88', attributes: { name: 'comedy' } }
    ]
  });

  let post = store.peekRecord('post', 1);
  post.set('genre.name', 'drama');
  post.set('tags.firstObject.name', 'tag1 change');
  let newTag = store.createRecord('tag', { name: 'new tag' });
  post.get('tags').addObject(newTag);
  let json = serialize(post, {
    attributes: false,
    relationships: ['author', 'tags', 'genre']
  });
  let expectedJSON = {
    data: {
      id: '1',
      type: 'posts',
      relationships: {
        author: {
          data: {
            id: '99',
            type: 'authors'
          }
        },
        genre: {
          data: {
            type: 'genres',
            id: '88',
            attributes: { name: 'drama' }
          }
        },
        tags: {
          data: [
            { type: 'tags', id: '2', attributes: { name: 'tag1 change' } },
            { type: 'tags', id: '3' },
            { type: 'tags', attributes: { name: 'new tag' } }
          ]
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON);
});

test('nested one-to-one', function(assert) {
  let state = store.createRecord('state', {
    name: 'New York'
  });

  let author = store.createRecord('author', {
    name: 'Joe Author',
    state: state
  });

  let post = store.createRecord('post', {
    author: author
  });

  let json = serialize(post, {
    attributes: false,
    relationships: { author: 'state' }
  });

  let expectedJSON = {
    data: {
      type: 'posts',
      relationships: {
        author: {
          data: {
            type: 'authors',
            attributes: { name: 'Joe Author' },
            relationships: {
              state: {
                data: {
                  type: 'states',
                  attributes: { name: 'New York'}
                }
              }
            }
          }
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON);
});

test('nested one-to-many', function(assert) {
  let user = store.createRecord('user', {
    name: 'Joe User'
  });

  let tag = store.createRecord('tag', {
    name: 'tag1',
    creator: user
  });

  let post = store.createRecord('post', {
    tags: [tag]
  });

  let json = serialize(post, {
    attributes: false,
    relationships: { tags: 'creator' }
  });

  let expectedJSON = {
    data: {
      type: 'posts',
      relationships: {
        tags: {
          data: [
            {
              type: 'tags',
              attributes: { name: 'tag1' },
              relationships: {
                creator: {
                  data: {
                    type: 'users',
                    attributes: { name: 'Joe User' }
                  }
                }
              }
            }
          ]
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON);
});

// tests a relationship hash like ['foo', { bar: 'baz' }]
test('array with nesting', function(assert) {
  let state = store.createRecord('state', {
    name: 'New York'
  });

  let author = store.createRecord('author', {
    name: 'Joe Author',
    state: state
  });

  let tag = store.createRecord('tag', {
    name: 'tag1'
  });

  let post = store.createRecord('post', {
    tags: [tag],
    author: author
  });

  let json = serialize(post, {
    attributes: false,
    relationships: ['tags', { author: 'state' }]
  });

  let expectedJSON = {
    data: {
      type: 'posts',
      relationships: {
        tags: {
          data: [
            { type: 'tags', attributes: { name: 'tag1' } }
          ]
        },
        author: {
          data: {
            type: 'authors',
            attributes: { name: 'Joe Author' },
            relationships: {
              state: {
                data: {
                  type: 'states',
                  attributes: { name: 'New York' }
                }
              }
            }
          }
        }
      }
    }
  };
  assert.deepEqual(json, expectedJSON);
});
