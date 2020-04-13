import { setupTest } from 'ember-qunit';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';
import { run } from '@ember/runloop';
import { A } from '@ember/array';
import { module, test } from 'qunit';

const seedPost = function(store) {
  store.pushPayload({
    data: {
      type: 'posts',
      id: '1',
      attributes: { title: 'test title' }
    }
  });
  return store.peekRecord('post', 1);
};


module('Unit | Mixin | model', function(hooks) {
  setupTest(hooks);
  setupMirage(hooks);

  test('#hasDirtyAttributes', function(assert) {
    run(() => {
      let store = this.owner.lookup('service:store');
      let post = store.createRecord('post');
      assert.ok(post.get('hasDirtyAttributes'), 'should be true when new record');
      post = seedPost(store);
      assert.notOk(post.get('hasDirtyAttributes'), 'should be false when persisted record with no changes');
      post.set('title', 'changed');
      assert.ok(post.get('hasDirtyAttributes'), 'should be true when persisted record with changes');
      post.set('title', 'test title');
      assert.notOk(post.get('hasDirtyAttributes'), 'should be false when attributes reset');
      post.set('_markedForDestruction', true);
      assert.ok(post.get('hasDirtyAttributes'), 'should be true when marked for destruction');
      post.set('_markedForDestruction', false);
      post.set('_markedForDeletion', true);
      assert.ok(post.get('hasDirtyAttributes'), 'should be true when marked for deletion');
    });
  });

  // note tag with id 3 does not send attributes
  test('resetting relations when only sending dirty relations', function(assert) {
    let store = this.owner.lookup('service:store');
    let done = assert.async();
    server.patch('/posts/:id', (db, request) => {
      let relationships = JSON.parse(request.requestBody).data.relationships;
      assert.deepEqual(relationships, {
        tags: {
          data: [
            {
              id: '2',
              method: 'update',
              type: 'tags',
            },
            {
              id: '3',
              type: 'tags'
            }
          ]
        }
      });

      let included = JSON.parse(request.requestBody).included;
      assert.deepEqual(included, [
        {
          id: '2',
          type: 'tags',
          attributes: { name: 'tag1 changed' }
        }
      ]);


      done();
      let post = db.posts.find(request.params.id);
      post.tags.models[0].update({ name: 'tag1 changed' });
      return post;
    });

    let post = server.create('post');
    post.createTag({ name: 'tag1' });
    post.createTag({ name: 'tag2' });
    run(() => {
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
    run(() => {
      post.save({ adapterOptions: { sideposting: true, relationships: 'tags' } }).then((p) => {
        assert.equal(p.get('tags.length'), 2);
        done2();
      });
    });
  });

  test('resetting nested relations', function(assert) {
    let store = this.owner.lookup('service:store');
    let done = assert.async();
    server.patch('/posts/:id', (db, request) => {
      let { included } = JSON.parse(request.requestBody);
      assert.ok(included.find((obj) => obj.type === 'descriptions'));

      done();
      let post = db.posts.find(request.params.id);
      post.tags.models[0].createDescription({ name: 'Description 2'});
      return post;
    });

    let post = server.create('post');
    post.createTag({ name: 'tag1' });
    post.createTag({ name: 'tag2' });
    let tag = post.tags.models[0];
    server.create('description', { tag: tag });

    run(() => {
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
          {
            type: 'tags',
            id: '2',
            attributes: { name: 'tag1' },
            relationships: {
              descriptions: {
                data: [
                  { type: 'descriptions', 'id': '1', method: 'create' }
                ]
              }
            }
          },
          { type: 'tags', id: '3', attributes: { name: 'tag2' } },
          { type: 'descriptions', 'id': '1', attributes: { name: 'description' } },
        ]
      });
    });

    let newDescription = store.createRecord('description', { name: 'Description 2'});
    post = store.peekRecord('post', 1);
    tag = post.tags.firstObject;
    tag.descriptions.addObject(newDescription);

    let done2 = assert.async();
    run(() => {
      post.save({ adapterOptions: { sideposting: true, relationships: ['tags', { tags: 'descriptions' }] } }).then(async (p) => {
        let tags = await p.tags;
        let descriptions = await tags.firstObject.descriptions;
        assert.equal(descriptions.length, 2);
        assert.equal(descriptions.firstObject.id, 1);
        assert.equal(descriptions.lastObject.id, 2);
        done2();
      });
    });
  });

  test('reset relationships for multiple records which have same relation name', async function(assert) {
    let store = this.owner.lookup('service:store');
    server.patch('/posts/:id', (db, request) => {
      let post = db.posts.find(request.params.id);
      post.tags.models[0].descriptions.models[0].destroy();
      return post;
    });

    let post = server.create('post');
    post.createTag({ name: 'tag1' });
    post.createTag({ name: 'tag2' });

    let tag1 = post.tags.models[0];
    let tag2 = post.tags.models[1];
    tag1.createDescription({ name: 'Description 1'});
    tag2.createDescription({ name: 'Description 1'});

    run(() => {
      store.pushPayload({
        data: {
          type: 'posts',
          id: 1,
          relationships: {
            tags: {
              data: [
                { type: 'tags', id: '1' },
                { type: 'tags', id: '2' }
              ]
            }
          }
        },
        included: [
          {
            type: 'tags',
            id: '1',
            relationships: {
              descriptions:{
                data: [
                  { type: 'descriptions', id: '1', method: 'destroy' }
                ]
              }
            }
          },
          {
            type: 'tags',
            id: '2',
            relationships: {
              descriptions: {
                data: [
                  { type: 'descriptions', id: '2' }
                ]
              }
            }
          }
        ]
      });
    });

    post = store.peekRecord('post', 1);
    post.tags.firstObject.descriptions.firstObject.markForDestruction();

    let done2 = assert.async();
    run(() => {
      post.save({ adapterOptions: { sideposting: true, relationships: ['tags', { tags: 'descriptions' }] } }).then((p) => {
        assert.equal(p.get('tags.length'), 2);
        assert.equal(p.get('tags.firstObject.descriptions.length'), 0);
        assert.equal(p.get('tags.lastObject.descriptions.length'), 1);
        done2();
      });
    });
  });

  test('it should correctly save deeply nested has many relations', async function(assert) {
    assert.expect(1);

    server.post('/posts', {
      data: {
        id: 1,
        type: 'posts'
      }
    });

    let store = this.owner.lookup('service:store');
    let post = store.createRecord('post');
    let tag = store.createRecord('tag');
    let description = store.createRecord('description');

    tag.set('descriptions', A([description]));
    post.set('tags', A([tag]));
    await post.save({ adapterOptions: { sideposting: true, relationships: ['tags', { tags: 'descriptions' }] } });
    assert.ok(true);
  });

  test('it should throw an error when marking an un-persisted record for destruction', async function(assert) {
    let store = this.owner.lookup('service:store');
    let post = store.createRecord('post');

    assert.throws(() => post.markForDestruction(), 'cannot mark un-persisted record for destruction');
  });
});
