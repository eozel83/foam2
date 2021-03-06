/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.dao',
  name: 'ProxyDAO',
  extends: 'foam.dao.AbstractDAO',

  requires: [
    'foam.dao.NullDAO',
    'foam.dao.ProxyListener',
  ],

  documentation: 'Proxy implementation for the DAO interface.',

  properties: [
    {
      class: 'Proxy',
      of: 'foam.dao.DAO',
      name: 'delegate',
      forwards: [ 'put_', 'remove_', 'find_', 'select_', 'removeAll_', 'cmd_', 'listen_' ],
      topics: [ 'on' ], // TODO: Remove this when all users of it are updated.
      factory: function() { return this.NullDAO.create() },
      postSet: function(old, nu) {
        if ( old ) this.on.reset.pub();
      },
      swiftFactory: 'return NullDAO_create()',
      swiftPostSet: `
if let oldValue = oldValue as? AbstractDAO {
  _ = oldValue.on["reset"].pub()
}
      `,
    },
    {
      name: 'of',
      factory: function() {
        return this.delegate.of;
      },
      swiftExpressionArgs: ['delegate$of'],
      swiftExpression: 'return delegate$of as! ClassInfo',
      javaFactory: `return getDelegate().getOf();`,
    }
  ],

  methods: [
    {
      name: 'listen',
      code: function listen(sink) {
        if ( ! foam.core.FObject.isInstance(sink) ) {
          sink = foam.dao.AnonymousSink.create({ sink: sink }, this);
        }

        var listener = this.ProxyListener.create({
          delegate: sink,
          dao: this
        });

        listener.onDetach(this.sub('propertyChange', 'delegate', listener.update));
        listener.update();

        return listener;
      },
      swiftCode: `
let listener = ProxyListener_create([
  "delegate": sink
])

listener.onDetach(listener.dao$.follow(delegate$))

return listener
      `,
      javaCode: `
// TODO: Support changing of delegate
super.listen(sink, predicate);
`
    }
  ],

  axioms: [
    {
      buildJavaClass: function(cls) {
        cls.extras.push(`
public ProxyDAO(foam.core.X x, foam.dao.DAO delegate) {
  foam.nanos.logger.Logger log = (foam.nanos.logger.Logger)x.get("logger");
  log.warning("Direct constructor use is deprecated. Use Builder instead.");
  setX(x);
  setDelegate(delegate);
}
        `);
      },
    },
  ],
});


foam.CLASS({
  package: 'foam.dao',
  name: 'ProxyListener',

  implements: ['foam.dao.Sink'],

  properties: [
    'args',
    {
      class: 'Proxy',
      of: 'foam.dao.Sink',
      name: 'delegate',
    },
    {
      name: 'innerSub',
      swiftType: 'Detachable?',
      postSet: function(_, s) {
        if (s) this.onDetach(s);
      },
      swiftPostSet: 'if let s = newValue { onDetach(s) }',
    },
    {
      name: 'dao',
      swiftType: 'DAO?',
      swiftPostSet: `
self.innerSub?.detach()
try? self.innerSub = newValue?.listen(self, args as? FoamPredicate)
if oldValue != nil {
  self.reset(Subscription(detach: {}))
}
      `
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(obj, s) {
        this.delegate.put(obj, this);
      },
      swiftCode: 'delegate.put(obj, self)',
    },

    function outputJSON(outputter) {
      outputter.output(this.delegate);
    },

    {
      name: 'remove',
      code: function remove(obj, s) {
        this.delegate.remove(obj, this);
      },
      swiftCode: 'delegate.remove(obj, self)',
    },

    {
      name: 'reset',
      code: function reset(s) {
        this.delegate.reset(this);
      },
      swiftCode: 'delegate.reset(self)',
    },
  ],
  listeners: [
    {
      name: 'update',
      code: function() {
        var old = this.innerSub;
        old && old.detach();
        this.innerSub = this.dao && this.dao.listen_(this.dao.__context__, this);
        if ( old ) this.reset();
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.dao',
  name: 'ArraySink',
  extends: 'foam.dao.AbstractSink',

  constants: {
    // Dual to outputJSON method.
    //
    // TODO(markdittmer): Turn into static method: "parseJSON" once
    // https://github.com/foam-framework/foam2/issues/613 is fixed.
    PARSE_JSON: function(json, opt_cls, opt_ctx) {
      var cls = json.of || opt_cls;
      var array = json.array;
      if ( ! array ) return foam.dao.ArraySink.create({ of: cls }, opt_ctx);
      if ( foam.typeOf(cls) === foam.String )
        cls = ( opt_ctx || foam ).lookup(cls);

      return foam.dao.ArraySink.create({
        of: cls,
        array: foam.json.parse(array, cls, opt_ctx)
      }, opt_ctx);
    }
  },

  properties: [
    {
      class: 'List',
      name: 'array',
      adapt: function(old, nu) {
        if ( ! this.of ) return nu;
        var cls = this.of;
        for ( var i = 0; i < nu.length; i++ ) {
          if ( ! cls.isInstance(nu[i]) )
            nu[i] = cls.create(nu[i], this.__subContext__);
        }
        return nu;
      },
      factory: function() { return []; },
      javaFactory: `return new java.util.ArrayList();`
    },
    {
      class: 'Class',
      name: 'of'
    },
    {
      name: 'a',
      transient: true,
      getter: function() {
        this.warn('Use of deprecated ArraySink.a');
        return this.array;
      }
    }
  ],

  methods: [
    {
      name: 'put',
      code: function put(o, sub) {
        var cls = this.of;
        if ( ! cls ) {
          this.array.push(o);
          return;
        }
        if ( cls.isInstance(o) )
          this.array.push(o);
        else
          this.array.push(cls.create(o, this.__subContext__));
      },
      swiftCode: 'array.append(obj)',
      javaCode: 'if ( getArray() == null ) setArray(new java.util.ArrayList());\n'
                +`getArray().add(obj);`
    },
    function outputJSON(outputter) {
      outputter.start('{');
      var outputClassName = outputter.outputClassNames;
      if ( outputClassName ) {
        outputter.nl().indent().out(
            outputter.maybeEscapeKey('class'), ':', outputter.postColonStr, '"',
            this.cls_.id, '"');
      }

      var array = this.array;
      var outputComma = outputClassName;
      if ( this.of ) {
        outputter.outputProperty(this, this.OF, outputComma);
        outputComma = true;
      }
      if ( array.length > 0 ) {
        if ( outputComma ) outputter.out(',');
        outputter.nl().indent().outputPropertyName(this.ARRAY).
            out(':', outputter.postColonStr).output(array, this.of);
      }
      outputter.nl().end('}');
    }
  ]
});


foam.CLASS({
  package: 'foam.dao',
  name: 'PromisedDAO',
  extends: 'foam.dao.AbstractDAO',

  properties: [
    {
      class: 'Promised',
      of: 'foam.dao.DAO',
      methods: [ 'put_', 'remove_', 'find_', 'select_', 'removeAll_', 'listen_', 'cmd_' ],
      name: 'promise'
    }
  ]
});


foam.CLASS({
  package: 'foam.dao',
  name: 'LocalStorageDAO',
  extends: 'foam.dao.ArrayDAO',

  properties: [
    {
      name:  'name',
      label: 'Store Name',
      class:  'foam.core.String'
    }
  ],

  methods: [
    function init() {
      var objs = localStorage.getItem(this.name);
      if ( objs ) this.array = foam.json.parseString(objs, this);

      this.on.put.sub(this.updated);
      this.on.remove.sub(this.updated);

      // TODO: base on an indexed DAO
    }
  ],

  listeners: [
    {
      name: 'updated',
      isMerged: true,
      mergeDelay: 100,
      code: function() {
        localStorage.setItem(this.name, foam.json.stringify(this.array));
      }
    }
  ]
});


foam.LIB({
  name: 'foam.String',
  methods: [
    {
      name: 'daoize',
      code: foam.Function.memoize1(function(str) {
        // Turns SomeClassName into someClassNameDAO,
        // of package.ClassName into package.ClassNameDAO
        return str.substring(0, 1).toLowerCase() + str.substring(1) + 'DAO';
      })
    }
  ]
});


foam.CLASS({
  package: 'foam.dao',
  name: 'InvalidArgumentException',
  extends: 'foam.dao.ExternalException',

  properties: [
    {
      class: 'String',
      name: 'message'
    }
  ]
});
