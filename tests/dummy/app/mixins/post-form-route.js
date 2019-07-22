import Mixin from '@ember/object/mixin';

export default Mixin.create({
  renderTemplate(controller, model) {
    this.render('post-form', {
      controller: 'post-form',
      model: model
    });
  },

  actions: {
    submit(model) {
      model.save({
        adapterOptions: {
          sideposting: true,
          relationships: { 'tags': {}, 'author': {} }
        }
      }).then((m) => {
        this.transitionTo('post', m.id);
      });
    },

    addTag(model) {
      let tag = this.store.createRecord('tag');
      model.get('tags').pushObject(tag);
    },

    removeTag(model, tag) {
      tag.markForDeletion();
    }
  }
});
