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
  package: 'foam.java',
  name: 'Code',

  properties: [
    {
      class: 'String',
      name: 'data'
    }
  ],

  methods: [
    function outputJava(o) {
      var lines = this.data.split('\n');
      for ( var i = 0 ; i < lines.length ; i++ ) {
        o.indent();
        o.out(lines[i], '\n');
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'CodeProperty',
  extends: 'Property',
  properties: [
    {
      name: 'adapt',
      value: function(o, v) {
        if ( typeof v === 'string' ) return foam.java.Code.create({ data: v });
        return v;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'Outputter',
  properties: [
    {
      name: 'indentLevel_',
      value: 0
    },
    {
      name: 'indentStr',
      value: '  '
    },
    {
      class: 'String',
      name: 'buf_'
    }
  ],
  methods: [
    function indent() {
      for ( var i = 0 ; i < this.indentLevel_ ; i++ ) this.buf_ += this.indentStr;
      return this;
    },
    function out() {
      for ( var i = 0 ; i < arguments.length ; i++ ) {
        if ( arguments[i] != null && arguments[i].outputJava ) { arguments[i].outputJava(this); }
        else this.buf_ += arguments[i];
      }
      return this;
    },
    function increaseIndent() {
      this.indentLevel_++;
    },
    function decreaseIndent() {
      this.indentLevel_--;
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'Argument',
  properties: [
    'type',
    'name'
  ],
  methods: [
    function outputJava(o) {
      o.out(this.type, ' ', this.name);
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'Method',
  properties: [
    'name',
    { class: 'String', name: 'visibility' },
    'static',
    'type',
    {
      class: 'FObjectArray',
      of: 'foam.java.Argument',
      name: 'args'
    },
    { class: 'foam.java.CodeProperty', name: 'body' }
  ],
  methods: [
    function outputJava(o) {
      o.indent();
      o.out(this.visibility, this.visibility ? ' ' : '',
        this.static ? 'static ' : '',
        this.type, ' ',
        this.name, '(');
      o.out.apply(o, this.args);
      o.out(')', '{\n');

      o.increaseIndent();
      o.out(this.body);
      o.decreaseIndent();
      o.indent();
      o.out('}');
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'Field',
  properties: [
    'name',
    { class: 'String', name: 'visibility' },
    'static',
    'type',
    'final',
    { class: 'foam.java.CodeProperty', name: 'initializer' }
  ],
  methods: [
    function outputJava(o) {
      o.indent();
      o.out(this.visibility, this.visibility ? ' ' : '',
        this.static ? 'static ' : '',
        this.final ? 'final ' : '',
        this.type, ' ', this.name);
      if ( this.initializer ) {
        o.increaseIndent();
        o.out(' = ', this.initializer);
        o.decreaseIndent();
      }
      o.out(';');
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'Class',
  properties: [
    'name',
    'package',
    'implements',
    {
      class: 'String',
      name: 'visibility',
      value: 'public'
    },
    'abstract',
    'extends',
    {
      class: 'FObjectArray',
      of: 'foam.java.Method',
      name: 'methods',
      factory: function() { return []; }
    },
    {
      class: 'FObjectArray',
      of: 'foam.java.Field',
      name: 'fields',
      factory: function() { return []; }
    },
    'imports',
    {
      class: 'Boolean',
      name: 'anonymous',
      value: false
    }
  ],
  methods: [
    function getField(name) {
      for ( var i  = 0 ; this.fields && i < this.fields.length ; i++ ) {
        if ( this.fields[i].name === name ) return this.fields[i];
      }
    },
    function getMethod(name) {
      for ( var i  = 0 ; this.methods && i < this.methods.length ; i++ ) {
        if ( this.methods[i].name === name ) return this.methods[i];
      }
    },
    function field(f) {
      this.fields.push(foam.java.Field.create(f));
      return this;
    },
    function method(m) {
      this.methods.push(foam.java.Method.create(m));
      return this;
    },
    function outputJava(o) {
      if ( this.anonymous ) {
        o.out('new ', this.extends, '()');
      } else {
        this.imports && this.imports.forEach(function(i) {
          o.out(i, ';\n');
        });

        o.out(this.visibility, ' ', 'class ', this.name);
        if ( this.implements && this.implements.length ) {
          o.out(' implements');
          for ( var i = 0 ; i < this.implements.length ; i++ ) {
            o.out(this.implements[i]);
            if ( i != this.implements.length - 1 ) o.out(', ');
          }
        }
        if ( this.extends ) {
          o.out(' extends ', this.extends);
        }
      }

      o.out(' {\n');

      o.increaseIndent();
      this.fields.forEach(function(f) { o.out(f, '\n'); });
      this.methods.forEach(function(f) { o.out(f, '\n'); });
      o.decreaseIndent();
      o.indent();
      o.out('}');
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'ClassInfo',
  properties: [
    {
      name: 'properties',
      factory: function() { return []; }
    }
  ],
  methods: [
    function addProperty(id) {
      this.properties.push(id);
    },
    function outputJava(o) {
      o.out('private static final foam.core.ClassInfo classInfo_ = new ClassInfo()')
      o.increaseIndent();
      for ( var i = 0 ; i < this.properties.length ; i++ ) {
        o.out('\n');
        o.indent();
        o.out('.addProperty(', this.properties[i], ')');
      }
      o.decreaseIndent()
      o.out(';');
    }
  ]
});

foam.LIB({
  name: 'foam.AbstractClass',
  methods: [
    function buildJavaClass(cls) {
      cls.name = this.model_.name;
      cls.package = this.model_.package;
      cls.extends = this.model_.extends === 'FObject' ?
        'foam.core.AbstractFObject' : this.model_.extends;
      cls.abstract = this.model_.abstract;

      cls.fields.push(foam.java.ClassInfo.create());
      cls.method({
        name: 'getClassInfo',
        type: 'foam.core.ClassInfo',
        body: 'return classInfo_;'
      })
      cls.method({
        name: 'getOwnClassInfo',
        static: true,
        type: 'foam.core.ClassInfo',
        body: 'return classInfo_'
      });

      var axioms = this.getAxioms();
      for ( var i = 0 ; i < axioms.length ; i++ ) {
        axioms[i].buildJavaClass && axioms[i].buildJavaClass(cls);
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'PropertyInfo',
  extends: 'foam.java.Class',
  properties: [
    ['anonymous', true],
    'propName',
    {
      name: 'getterName',
      expression: function(propName) {
        return 'get' + foam.String.capitalize(propName);
      }
    },
    {
      name: 'setterName',
      expression: function(propName) {
        return 'set' + foam.String.capitalize(propName);
      }
    },
    'sourceCls',
    'propType',
    'jsonParser',
    {
      name: 'methods',
      factory: function() {
        return [
          {
            name: 'getName',
            visibility: 'public',
            type: 'String',
            body: 'return "' + this.propName + '";'
          },
          {
            name: 'get',
            visibility: 'public',
            type: 'Object',
            args: [ { name: 'o', type: 'Object' } ],
            body: 'get_(o);'
          },
          {
            name: 'get_',
            type: this.propType,
            visibility: 'public',
            args: [ { name: 'o', type: 'Object' } ],
            body: 'return ((' + this.sourceCls.name + ')o).' + this.getterName + '();'
          },
          {
            name: 'set',
            type: 'void',
            visibility: 'public',
            args: [ { name: 'o', type: 'Object' }, { name: 'value', type: 'Object' } ],
            body: '((' + this.sourceCls.name + ')o).' + this.setterName + '((' + this.propType + ')value);'
          },
          {
            name: 'compare',
            type: 'int',
            visibility: 'public',
            args: [ { name: 'o1', type: 'Object' }, { name: 'o2', type: 'Object' } ],
            body: 'return compareValues(get_(o1),get_(o2));'
          },
          {
            name: 'jsonParser',
            type: 'foam.lib.parse.Parser',
            visibility: 'public',
            body: 'return new ' + this.jsonParser + '();'
          }
        ]
      }
    }
  ],
  methods: [
  ]
});

foam.CLASS({
  refines: 'foam.core.Property',
  methods: [
    function buildJavaClass(cls) {
      var privateName = this.name + '_';
      var capitalized = foam.String.capitalize(this.name);
      var constantize = foam.String.constantize(this.name);

      cls
        .field({
          name: privateName,
          type: this.javaType,
          visibility: 'private'
        })
        .method({
          name: 'get' + capitalized,
          type: this.javaType,
          visibility: 'public',
          body: 'return ' + privateName
        })
        .method({
          name: 'set' + capitalized,
          visibility: 'public',
          args: [
            {
              type: this.javaType,
              name: 'val'
            }
          ],
          type: cls.name,
          body: privateName + ' = val;\n'
            + 'return this'
        });


      cls.field({
        name: constantize,
        static: true,
        type: 'foam.core.PropertyInfo',
        initializer: foam.java.PropertyInfo.create({
          sourceCls: cls,
          propName: this.name,
          propType: this.javaType,
          jsonParser: this.javaJSONParser,
          extends: this.javaInfoType
        })
      });

      var info = cls.getField('classInfo_');
      if ( info ) info.addProperty(cls.name + '.' + constantize);
    }
  ]
});
