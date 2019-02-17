import { module, test } from 'qunit';
import page from 'dummy/tests/pages/post-form';
import detailPage from 'dummy/tests/pages/show-post';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';

module('Acceptance | update nested relations', function(hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('updating nested relations', async function(assert) {
    let author = server.create('author', { name: 'Joe Author' });
    let tag1 = server.create('tag', { name: 'tag1' });
    let tag2 = server.create('tag', { name: 'tag2' });
    let post = server.create('post', {
      author: author,
      tags: [tag1, tag2],
      title: 'test title'
    });
    await visit(`/posts/${post.id}/edit`);

    assert.equal(page.title.val, 'test title');
    assert.equal(page.authorName.val, 'Joe Author');
    assert.equal(page.tags.length, 2);
    assert.equal(page.tags.objectAt(0).name, 'tag1');
    assert.equal(page.tags.objectAt(1).name, 'tag2');

    await page.authorName.fillIn('new author');
    await page.tags.objectAt(1).setName('tag2 changed');
    await page.addTag();
    await page.tags.objectAt(2).setName('new tag');
    await page.submit();

    await post.reload();
    assert.equal(post.author.id, author.id, 'updates existing author');
    assert.equal(detailPage.authorName, 'new author', 'updates author name');
    assert.equal(detailPage.tagList, 'tag1, tag2 changed, new tag', 'updates one-to-many correctly');
  });

  test('updating only one member of a hasMany relation', async function(assert) {
    server.foo = 'bar';
    let tag1 = server.create('tag', { name: 'tag1' });
    let tag2 = server.create('tag', { name: 'tag2' });
    let post = server.create('post', {
      tags: [tag1, tag2],
    });
    await visit(`/posts/${post.id}/edit`);

    assert.equal(page.tags.length, 2);
    await page.tags.objectAt(0).setName('tag1 changed');
    await page.submit();

    assert.equal(detailPage.tagList, 'tag1 changed, tag2');
  });
});
