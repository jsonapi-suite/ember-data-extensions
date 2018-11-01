import DS from 'ember-data';
import NestedRelationsMixin from 'ember-data-extensions/mixins/nested-relations';
import { underscore } from '@ember/string';

export default DS.JSONAPISerializer.extend(NestedRelationsMixin, {
  keyForAttribute(key /* relationship, method */) {
    return underscore(key);
  }
});
