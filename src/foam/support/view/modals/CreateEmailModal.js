foam.CLASS({
    package: 'foam.support.view.modals',
    name: 'CreateEmailModal',
    extends: 'foam.u2.View',

    methods: [
        function initE(){
            this
                .start()
                .add('modal')
                .end();
        }
    ]
});