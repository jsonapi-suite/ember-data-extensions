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
  title: DS.attr('string'),
  author: DS.belongsTo({ async: false })
});

moduleForAcceptance('Unit | Mixin | model', {
  beforeEach() {
    getOwner(this).register('service:store', TestStore);
    store = getOwner(this).lookup('service:store');
    getOwner(this).register('model:post', Post);
    getOwner(this).register('model:author', Author);
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

test('#save when resetRelations: false', function(assert) {
  Ember.run(() => {
    let author = store.createRecord('author', { name: 'Joe Author' });
    let post = store.createRecord('post', { title: 'title', author: author });

    let done = assert.async();
    post.save({ resetRelations: false }).then((p) => {
      assert.equal(p.get('author'), author);
      done();
    });
  });
});

test('#save when resetRelations: true', function(assert) {
  Ember.run(() => {
    let author = store.createRecord('author', { name: 'Joe Author' });
    let post = store.createRecord('post', { title: 'title', author: author });

    let done = assert.async();
    post.save().then((p) => {
      let author = p.get('author');
      assert.equal(author, null);
      done();
    });
  });
});
