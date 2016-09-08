import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';
import page from 'dummy/tests/pages/post-form';
import detailPage from 'dummy/tests/pages/show-post';

moduleForAcceptance('Acceptance | delete nested objects');

test('deleting a nested object', function(assert) {
  page.visit();
  page.addTag().tags(0).setName('a');
  page.submit();

  andThen(function() {
    assert.equal(detailPage.tagList, 'a');
    detailPage.edit();

    andThen(function() {
      page.addTag().tags(1).setName('b');
      page.submit();

      andThen(function() {
        detailPage.edit();

        andThen(function() {
          page.tags(0).remove();

          andThen(function() {
            assert.equal(page.tags().count, 1, 'should not show removed tag');
            page.submit();

            andThen(function() {
              assert.equal(detailPage.tagList, 'b', 'should delete removed tag');
            });
          });
        });
      });
    });
  });
});
