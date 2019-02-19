import { module, test } from 'qunit';
import page from 'dummy/tests/pages/post-form';
import detailPage from 'dummy/tests/pages/show-post';
import { setupApplicationTest } from 'ember-qunit';
import setupMirage from 'ember-cli-mirage/test-support/setup-mirage';

module('Acceptance | delete nested objects', function(hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('deleting a nested object', async function(assert) {
    await page.visit();
    await page.addTag().tags.objectAt(0).setName('a');
    await page.submit();

    assert.equal(detailPage.tagList, 'a');
    await detailPage.edit();
    await page.addTag().tags.objectAt(1).setName('b');
    await page.submit();
    await detailPage.edit();
    await page.tags.objectAt(0).remove();

    assert.equal(page.tags.length, 1, 'should not show removed tag');

    await page.submit();

    assert.equal(detailPage.tagList, 'b', 'should delete removed tag');
  });
});
