import DS from 'ember-data';
import ModelMixin from 'ember-data-extensions/mixins/model';

export default DS.Model.extend(ModelMixin, {
  name: DS.attr('string')
});
