import DS from 'ember-data';
import NestedRelationsMixin from 'ember-data-extensions/mixins/nested-relations';
import Ember from 'ember';
export default DS.JSONAPISerializer.extend(NestedRelationsMixin, {
  keyForAttribute(key /* relationship, method */) {
    return Ember.String.underscore(key);
  }
});
