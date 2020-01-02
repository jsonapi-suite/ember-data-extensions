import DS from 'ember-data';
import NestedRelationsMixin from 'ember-data-extensions/mixins/nested-relations';
import ModelMixin from 'ember-data-extensions/mixins/model';
import { run } from '@ember/runloop';
import { module, skip, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';

QUnit.dump.maxDepth = 999999999;

let store = null;
let serializer = null;

const State = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string')
});

const Author = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string'),
  state: DS.belongsTo(),
  genres: DS.hasMany('genre')
});

const User = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string')
});

const Tag = DS.Model.extend(ModelMixin, NestedRelationsMixin, {
  name: DS.attr('string'),
  creator: DS.belongsTo('user'),
  subject: DS.belongsTo('author')
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

const serialize = function(record, adapterOptions) {
  // Enable sideposting for testing unless it is disabled explicitly.
  if (adapterOptions.sideposting !== false) {
    adapterOptions.sideposting = true;
  }
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

module('Unit | Mixin | nested-relations', function(hooks) {
  setupTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function() {
    store = this.owner.lookup('service:store');

    this.owner.register('test-container:test-serializer', TestSerializer);
    serializer = this.owner.lookup('test-container:test-serializer');
    serializer.store = store;

    this.owner.register('model:post', Post);
    this.owner.register('model:tag', Tag);
    this.owner.register('model:author', Author);
    this.owner.register('model:genre', Genre);
    this.owner.register('model:state', State);
    this.owner.register('model:user', User);
  });

  test('it serializes basic attributes correctly', function(assert) {
    run(() => {
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
  });

  test('it serializes relationships if ember data ext is enabled', function(assert) {
    run(() => {
      let author = store.createRecord('author', { name: 'Joe Author' });
      let post = store.createRecord('post', { title: 'test post', 'author': author });
      let json = serialize(post, { sideposting: true, relationships: 'author' });

      let expectedJSON = {
        data: {
          attributes: {
            title: "test post"
          },
          relationships: {
            author: {
              data: {
                method: "create",
                'temp-id': author.tempId(),
                type: "authors"
              }
            }
          },
          type: "posts"
        },
        included: [
          {
            attributes: {
              name: "Joe Author"
            },
            'temp-id': author.tempId(),
            type: "authors"
          }
        ]
      };

      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  test('it does not serialize relationships if ember data ext is disabled', function(assert) {
    run(() => {
      let author = store.createRecord('author', { name: 'Joe Author' });
      let post = store.createRecord('post', { title: 'test post', 'author': author });
      let json = serialize(post, { sideposting: false });

      let expectedJSON = {
        data: {
          type: 'posts',
          attributes: {
            'published-date': null,
            title: 'test post'
          }
        }
      };

      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  test('it respects custom keyForAttribute settings in serializer', function(assert) {
    run(() => {
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
  });

  test('it does not serialize undefined attributes', function(assert) {
    run(() => {
      let post = store.createRecord('post');
      let json = serialize(post, {});

      let expectedJSON = { data: { type: 'posts' } };
      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  test('it does not serialize non-dirty attributes', function(assert) {
    run(() => {
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
  });

  test('excluding attributes', function(assert) {
    run(() => {
      let post = store.createRecord('post', { title: 'test post' });
      let json = serialize(post, { attributes: false });
      assert.notOk(json.data.hasOwnProperty('attributes'), 'attributes not included');
      json = serialize(post, {});
      assert.deepEqual(json.data.attributes, { title: 'test post' }, 'attributes included');
    });
  });

  test('it serializes one-to-one correctly', function(assert) {
    run(() => {
      let author = store.createRecord('author', { name: 'Joe Author' });
      let post = store.createRecord('post', {
        author: author
      });
      let json = serialize(post, { attributes: false, relationships: 'author' });
      let expectedJSON = {
        data: {
          type: 'posts',
          relationships: {
            author: {
              data: {
                type: 'authors',
                'temp-id': author.tempId(),
                method: 'create'
              }
            }
          }
        },
        included: [
          {type: 'authors', 'temp-id': author.tempId(), attributes: { name: 'Joe Author' }}
        ]
      };
      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  skip('it serializes async: false relationships correctly', function(assert) {

    run(() => {
      // NOTE: Not sure if I'm doing this right with the async thing
      let author = store.createRecord('author', { name: 'Joe Author' });
      let post = store.createRecord('post', {
        asyncFalseAuthor: author
      });
      let json = serialize(post, { attributes: false, relationships: 'asyncFalseAuthor' });
      let expectedJSON = {
        data: {
          type: 'posts',
          relationships: {
            'async-false-author': {
              data: {
                type: 'authors',
                method: 'create',
                'temp-id': author.tempId()
              }
            }
          }
        },
        included: [
          { type: 'authors', 'temp-id': author.tempId(), attributes: { name: 'Joe Author' }}
        ]
      };
      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  test('it serializes has one marked for deletion correctly', function(assert) {
    run(() => {
      seedPostWithAuthor();

      let post = store.peekRecord('post', 1);
      post.get('author').set('_markedForDeletion', true);

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
                method: 'disassociate'
              }
            }
          }
        }
      };

      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  test('it serializes has one marked for destruction correctly', function(assert) {
    run(() => {
      seedPostWithAuthor();

      let post = store.peekRecord('post', 1);
      post.get('author').set('_markedForDestruction', true);

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
                method: 'destroy'
              }
            }
          }
        }
      };
      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  test('it serializes one-to-many correctly', function(assert) {
    run(() => {
      let tag = store.createRecord('tag', { name: 'tag1' });
      let post = store.createRecord('post', {
        tags: [
          tag
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
                  'temp-id': tag.tempId(),
                  method: 'create'
                }
              ]
            }
          }
        },
        included: [
          { type: 'tags', 'temp-id': tag.tempId(), attributes: { name: 'tag1' } }
        ]
      };
      assert.deepEqual(json, expectedJSON, 'has correct json');
    });
  });

  // note tag 2 does not pass attributes
  test('one-to-many deletion/destruction', function(assert) {
    run(() => {
      seedPostWithTags();
      let post = store.peekRecord('post', 1);
      post.get('tags').objectAt(1).set('_markedForDeletion', true);
      post.get('tags').objectAt(2).set('_markedForDestruction', true);
      let json = serialize(post, { attributes: false, relationships: 'tags' });
      let expectedJSON = {
        data: {
          id: '1',
          type: 'posts',
          relationships: {
            tags: {
              data: [
                { type: 'tags', id: '2' },
                { type: 'tags', id: '3', method: 'disassociate' },
                { type: 'tags', id: '4', method: 'destroy' }
              ]
            }
          }
        }
      };
      assert.deepEqual(json, expectedJSON, 'it has correct json');
    });
  });

  test('relationship specified but not present', function(assert) {
    run(() => {
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
  });

  test('does not serialize attributes of non-dirty relations', function(assert) {
    run(() => {
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
                method: 'update'
              }
            },
            tags: {
              data: [
                { type: 'tags', id: '2', method: 'update' },
                { type: 'tags', id: '3' },
                { type: 'tags', 'temp-id': newTag.tempId(), method: 'create' }
              ]
            }
          }
        },
        included: [
          {type: 'tags', id:'2', attributes: { name: 'tag1 change' }},
          {type: 'tags', 'temp-id': newTag.tempId(), attributes: { name: 'new tag' }},
          {type: 'genres', id: '88', attributes: { name: 'drama' }}
        ]
      };
      assert.deepEqual(json, expectedJSON);
    });
  });

  test('nested one-to-one', function(assert) {
    run(() => {
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
                method: 'create',
                'temp-id': author.tempId(),
              }
            }
          }
        },
        included: [
          {
            type: 'states',
            'temp-id': state.tempId(),
            attributes: { name: 'New York' }
          },
          {
            type: 'authors',
            'temp-id': author.tempId(),
            attributes: { name: 'Joe Author' },
            relationships: {
              state: {
                data: {
                  type: 'states',
                  'temp-id': state.tempId(),
                  method: 'create',
                }
              }
            }
          }
        ]
      };
      assert.deepEqual(json, expectedJSON);
    });
  });

  test('nested one-to-many', function(assert) {
    run(() => {
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
                  'temp-id': tag.tempId(),
                  method: 'create'
                }
              ]
            }
          }
        },
        included: [
          {
            type: 'users',
            'temp-id': user.tempId(),
            attributes: { name: 'Joe User' }
          },
          {
            type: 'tags',
            'temp-id': tag.tempId(),
            attributes: { name: 'tag1' },
            relationships: {
              creator: {
                data: {
                  type: 'users',
                  'temp-id': user.tempId(),
                  method: 'create'
                }
              }
            }
          }
        ]
      };
      assert.deepEqual(json, expectedJSON);
    });
  });

  // tests a relationship hash like ['foo', { bar: 'baz' }]
  test('array with nesting', function(assert) {
    run(() => {
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
                { type: 'tags', 'temp-id': tag.tempId(), method: 'create' }
              ]
            },
            author: {
              data: {
                type: 'authors',
                'temp-id': author.tempId(),
                method: 'create'
              }
            }
          }
        },
        included: [
          { type: 'tags', 'temp-id': tag.tempId(), attributes: { name: 'tag1' } },
          { type: 'states', 'temp-id': state.tempId(), attributes: { name: 'New York' } },
          {
            type: 'authors',
            'temp-id': author.tempId(),
            attributes: { name: 'Joe Author' },
            relationships: {
              state: {
                data: {
                  method: 'create',
                  type: 'states',
                  'temp-id': state.tempId(),
                }
              }
            }
          }
        ]
      };
      assert.deepEqual(json, expectedJSON);
    });
  });

  test('it should correctly merge relationships of a record', function(assert) {
    run(() => {
      let state = store.createRecord('state', { name: 'New York' });
      let genre = store.createRecord('genre', { name: 'Maltese' });
      let author = store.createRecord('author', { name: 'Joe Author', state, genres: [genre] });
      let tag = store.createRecord('tag', { name: 'tag1', subject: author });
      let post = store.createRecord('post', { title: 'test post', tags: [tag], author });
      let json = serialize(post, { sideposting: true, relationships: [{ tags: { subject: 'genres' } }, { author: 'state' }] });

      let includedAuthor = json.included.find((datum) => datum.type === 'authors');
      assert.ok(includedAuthor.relationships.state.data);
      assert.ok(includedAuthor.relationships.genres.data);
    });
  });

  test('it should correctly merge relationships of a record in reverse order', function(assert) {
    run(() => {
      let state = store.createRecord('state', { name: 'New York' });
      let author = store.createRecord('author', { name: 'Joe Author', state });
      let tag = store.createRecord('tag', { name: 'tag1', subject: author });
      let post = store.createRecord('post', { title: 'test post', tags: [tag], author });
      let json = serialize(post, { sideposting: true, relationships: [{ author: 'state' }, { tags: { subject: 'genres' } }] });

      let includedAuthor = json.included.find((datum) => datum.type === 'authors');
      assert.ok(includedAuthor.relationships.state.data);
      assert.ok(includedAuthor.relationships.genres.data);
    });
  });
});
