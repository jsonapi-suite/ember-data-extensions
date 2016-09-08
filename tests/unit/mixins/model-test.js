import Ember from 'ember';
import DS from 'ember-data';
import ModelMixin from 'ember-data-extensions/mixins/model';
import moduleForAcceptance from '../../../tests/helpers/module-for-acceptance';
import getOwner from '../../../tests/helpers/get-owner';

let store = null;
let TestStore = DS.Store.extend();

const Author = DS.Model.extend(ModelMixin, {
  name: DS.attr('string')
});

const Post = DS.Model.extend(ModelMixin, {
  title:  DS.attr('string'),
  author: DS.belongsTo({ async: false }),
  tags:  DS.hasMany({ async: true })
});

const Tag = DS.Model.extend(ModelMixin, {
  name: DS.attr('string')
});

moduleForAcceptance('Unit | Mixin | model', {
  beforeEach() {
    getOwner(this).register('service:store', TestStore);
    store = getOwner(this).lookup('service:store');
    getOwner(this).register('model:post', Post);
    getOwner(this).register('model:author', Author);
    getOwner(this).register('model:tag', Tag);
  }
});

const seedPost = function() {
  store.pushPayload({
    data: {
      type: 'posts',
      id: '1',
      attributes: { title: 'test title' }
    }
  });
  return store.peekRecord('post', 1);
};

test('#hasDirtyAttributes', function(assert) {
  Ember.run(() => {
    let post = store.createRecord('post');
    assert.ok(post.get('hasDirtyAttributes'), 'should be true when new record');
    post = seedPost();
    assert.notOk(post.get('hasDirtyAttributes'), 'should be false when persisted record with no changes');
    post.set('title', 'changed');
    assert.ok(post.get('hasDirtyAttributes'), 'should be true when persisted record with changes');
    post.set('title', 'test title');
    assert.notOk(post.get('hasDirtyAttributes'), 'should be false when attributes reset');
    post.set('markedForDestruction', true);
    assert.ok(post.get('hasDirtyAttributes'), 'should be true when marked for destruction');
    post.set('markedForDestruction', false);
    post.set('markedForDeletion', true);
    assert.ok(post.get('hasDirtyAttributes'), 'should be true when marked for deletion');
  });
});

// note tag with id 3 does not send attributes
test('resetting relations when only sending dirty relations', function(assert) {
  let done = assert.async();
  server.patch('/posts/:id', (db, request) => {
    let relationships = JSON.parse(request.requestBody).data.relationships;
    assert.deepEqual(relationships, {
      tags: {
        data: [
          {
            id: '2',
            type: 'tags',
            attributes: { name: 'tag1 changed' }
          },
          {
            id: '3',
            type: 'tags'
          }
        ]
      }
    });
    done();
    let post = db.posts.find(request.params.id);
    post.tags.models[0].update({ name: 'tag1 changed' });
    return post;
  });

  let post = server.create('post');
  post.createTag({ name: 'tag1' });
  post.createTag({ name: 'tag2' });
  Ember.run(() => {
    store.pushPayload({
      data: {
        type: 'posts',
        id: 1,
        relationships: {
          tags: {
            data: [
              { type: 'tags', id: '2' },
              { type: 'tags', id: '3' }
            ]
          }
        }
      },
      included: [
        { type: 'tags', id: '2', attributes: { name: 'tag1' } },
        { type: 'tags', id: '3', attributes: { name: 'tag2' } }
      ]
    });
  });

  post = store.peekRecord('post', 1);
  assert.equal(post.get('tags.length'), 2);
  post.set('tags.firstObject.name', 'tag1 changed');

  let done2 = assert.async();
  Ember.run(() => {
    post.save({ adapterOptions: { relationships: 'tags' } }).then((p) => {
      assert.equal(p.get('tags.length'), 2);
      done2();
    });
  });
});
