import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';
import page from 'dummy/tests/pages/post-form';
import detailPage from 'dummy/tests/pages/show-post';

moduleForAcceptance('Acceptance | create nested relations');

test('creating a record with nested relations', function(assert) {
  page
    .visit()
    .title.fillIn('my post');

  page.addTag().tags(0).setName('new tag 1');
  page.addTag().tags(1).setName('new tag 2');
  page.addTag();
  page.authorName.fillIn('John Doe');
  page.submit();

  andThen(function() {
    assert.equal(detailPage.title, 'my post', 'saves basic attributes correctly');
    assert.equal(detailPage.tagList, 'new tag 1, new tag 2', 'saves one-to-many correctly');
    assert.equal(detailPage.tagIds, '1, 2', 'maintains one-to-many ids correctly');
    assert.equal(detailPage.authorName, 'John Doe', 'saves one-to-one correctly');
    assert.equal(detailPage.authorId, '1', 'maintains one-to-one ids correctly');
  });
});
