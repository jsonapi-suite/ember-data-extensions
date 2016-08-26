import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';
import page from 'dummy/tests/pages/post-form';
import detailPage from 'dummy/tests/pages/show-post';

moduleForAcceptance('Acceptance | update nested relations');

// Todo test ideally
// * delete
// * disassociate
test('updating nested relations', function(assert) {
  let author = server.create('author', { name: 'Joe Author' });
  let tag1 = server.create('tag', { name: 'tag1' });
  let tag2 = server.create('tag', { name: 'tag2' });
  let post = server.create('post', {
    author: author,
    tags: [tag1, tag2],
    title: 'test title'
  });
  visit(`/posts/${post.id}/edit`);

  andThen(function() {
    assert.equal(page.title.val, 'test title');
    assert.equal(page.authorName.val, 'Joe Author');
    assert.equal(page.tags().count, 2);
    assert.equal(page.tags(0).name, 'tag1');
    assert.equal(page.tags(1).name, 'tag2');

    page.authorName.fillIn('new author');
    page.tags(1).setName('tag2 changed');
    page.addTag();
    page.tags(2).setName('new tag');
    page.submit();

    andThen(function() {
      post.reload();
      assert.equal(post.author.id, author.id, 'updates existing author');
      assert.equal(detailPage.authorName, 'new author', 'updates author name');
      assert.equal(detailPage.tagList, 'tag1, tag2 changed, new tag', 'updates one-to-many correctly');
    });
  });
});
