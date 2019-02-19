import { JSONAPISerializer } from 'ember-cli-mirage';

export default JSONAPISerializer.extend({
  // Checkout this release notes:
  // https://github.com/samselikoff/ember-cli-mirage/releases/tag/v0.4.0
  alwaysIncludeLinkageData: true
});
