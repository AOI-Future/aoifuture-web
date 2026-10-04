import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../src/lib/backside/backside-world.schema.json';
import { compileTopology } from '../src/lib/backside/compiler';
import { compileReality } from '../src/lib/backside/compile-reality';
import { sampleTown } from '../src/lib/backside/fixtures/sample-town';
import { fromOverpass } from '../src/lib/backside/providers/overpass';
import { gridArea, gridResponse } from '../src/lib/backside/fixtures/overpass-grid';

const validate=new Ajv({allErrors:true}).compile(schema);
const real=()=>compileReality(fromOverpass(gridResponse(),gridArea));

describe('backside world schema', () => {
  it('accepts compiled worlds from reality and from the sample town', () => {
    expect(validate(real()),JSON.stringify(validate.errors)).toBe(true);
    expect(validate(compileTopology(sampleTown)),JSON.stringify(validate.errors)).toBe(true);
  });

  it('is deterministic for the same source', () => {
    expect(real()).toEqual(real());
  });

  it('rejects malformed worlds', () => {
    const w=real();
    const bad=[
      {...w,extra:1},
      {...w,version:'backside-compiler/9.9.9'},
      {...w,seed:-1},
      {...w,sectors:[]},
      {...w,sectors:[{...w.sectors[0],poi:'casino'},...w.sectors.slice(1)]},
      {...w,sectors:[{...w.sectors[0],osmId:'123'},...w.sectors.slice(1)]},
      {...w,sectors:[{...w.sectors[0],variant:3},...w.sectors.slice(1)]},
      {...w,spawn:{sector:w.spawn.sector,x:0}},
      {...w,questAnchors:[{...w.questAnchors[0],role:'boss'}]},
    ];
    for(const b of bad) expect(validate(b)).toBe(false);
    const {sectors:_,...missing}=w;
    expect(validate(missing)).toBe(false);
  });

  it('throws when the compiled world fails its own checks', () => {
    expect(()=>compileReality({...fromOverpass(gridResponse(),gridArea),ways:[]})).toThrow();
  });
});
