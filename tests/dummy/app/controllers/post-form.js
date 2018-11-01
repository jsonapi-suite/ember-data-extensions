import Controller from '@ember/controller';
import { filterBy } from '@ember/object/computed';

export default Controller.extend({
  tags: filterBy('model.tags', 'markedForDeletion', false)
});
