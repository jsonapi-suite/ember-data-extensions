import DS from 'ember-data';
import NestedRelationsMixin from 'ember-data-extensions/mixins/nested-relations';

export default DS.JSONAPISerializer.extend(NestedRelationsMixin, {
});
