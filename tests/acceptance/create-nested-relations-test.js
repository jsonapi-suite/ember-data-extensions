import { module, test } from 'qunit';
import page from 'dummy/tests/pages/post-form';
import detailPage from 'dummy/tests/pages/show-post';
import { setupApplicationTest } from 'ember-qunit';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';

module('Acceptance | create nested relations', function(hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('creating a record with nested relations', async function(assert) {
    await page.visit().title.fillIn('my post');

    await page.addTag().tags.objectAt(0).setName('new tag 1');
    await page.addTag().tags.objectAt(1).setName('new tag 2');
    await page.addTag();
    await page.authorName.fillIn('John Doe');
    await page.submit();

    assert.equal(detailPage.title, 'my post', 'saves basic attributes correctly');
    assert.equal(detailPage.tagList, 'new tag 1, new tag 2', 'saves one-to-many correctly');
    assert.equal(detailPage.tagIds, '1, 2', 'maintains one-to-many ids correctly');
    assert.equal(detailPage.authorName, 'John Doe', 'saves one-to-one correctly');
    assert.equal(detailPage.authorId, '1', 'maintains one-to-one ids correctly');
  });
});
