import metadata from './bluePlayApi.generated.json';
import type { CallableMeta, ManifestClass, SymbolManifest, TypeRef } from '../../runtime-contract/src/index';

export interface BluePlayApiMember { signature: string; description: string }
export interface BluePlayApiSection { title: string; members: BluePlayApiMember[] }
export interface BluePlayApiDoc { title: string; summary: string; sections: BluePlayApiSection[] }

// Only explanatory text is authored here. Every signature comes from Kotlite's
// generated library manifest; opening the help does not execute project code.
const descriptions: Record<string, Record<string, string>> = {
  World: {
    create: 'Creates a grid of cells; cellSize is measured in pixels.',
    width: 'Width in cells.', height: 'Height in cells.', cellSize: 'Pixels per cell.',
    background: 'Background image.', numberOfObjects: 'Number of actors in this world.', isClicked: 'Whether the world itself was clicked.',
    show: 'Displays this world and pauses the simulation.', act: 'Override to define what happens on each step.',
    addObject: 'Places an actor at (x, y); moves it from its previous world.', removeObject: 'Removes an actor.',
    allObjects: 'A copy of the list of all actors.', getObjects: 'All actors of type T.', getObjectsAt: 'All actors in cell (x, y).',
    setBackground: 'Sets the background from an image file or RGB color.', showText: 'Text at (x, y); an empty string removes it.',
  },
  Actor: {
    create: 'Creates an actor without a world.', world: 'Containing world; throws if the actor has no world.', image: 'Appearance; null uses a placeholder.',
    x: 'Column in cells; limited to the world bounds.', y: 'Row in cells; limited to the world bounds.',
    rotation: 'Heading in degrees: 0 is right, clockwise.', isAtEdge: 'Whether the actor is at the world edge; requires a world.', isClicked: 'Whether this actor was clicked; requires a world.',
    act: 'Override to define what happens on each step.', move: 'Moves in the current heading, in cells.', turn: 'Changes the heading by degrees.',
    turnTowards: 'Faces cell (x, y).', distanceTo: 'Distance to another actor, in cells.', intersects: 'Whether visible image pixels overlap; both actors require a world.',
    getIntersecting: 'All overlapping actors of type T; requires a world.', getOneIntersecting: 'One overlapping actor of type T, or null; requires a world.',
    isTouching: 'Whether an actor of type T overlaps; requires a world.', removeTouching: 'Removes one overlapping actor of type T; requires a world.',
  },
  Image: {
    'constructor:2': 'Creates an empty, transparent image.', 'constructor:String': 'Loads a file from images/.', 'constructor:Image': 'Copies an image.',
    width: 'Width in pixels.', height: 'Height in pixels.', setColor: 'Drawing color; RGB values from 0 to 255.', fill: 'Fills the entire image.',
    fillRect: 'Draws a filled rectangle.', drawRect: 'Draws a rectangle outline.', fillOval: 'Draws a filled oval.', drawOval: 'Draws an oval outline.',
    drawLine: 'Draws a line between two points.', drawString: 'Draws text at (x, y).', drawImage: 'Draws a copy of another image at (x, y).',
    clear: 'Makes the image transparent.', scale: 'Scales to the given size in pixels.', setTransparency: 'Opacity: 0 is invisible, 255 is opaque.',
  },
  BluePlayFunctions: {
    isKeyDown: 'Whether the named key is held down.', start: 'Starts repeated simulation steps.', stop: 'Pauses the simulation.', step: 'Runs one step while the simulation is paused.',
    getSpeed: 'Current speed from 1 to 100.', setSpeed: 'Sets the speed from 1 to 100.', playSound: 'Plays a WAV or MP3 file from sounds/ once.',
  },
};
const order: Record<string, string[]> = {
  World: ['width', 'height', 'cellSize', 'background', 'numberOfObjects', 'isClicked', 'show', 'act', 'addObject', 'removeObject', 'getObjects', 'getObjectsAt', 'allObjects', 'setBackground', 'showText'],
  Actor: ['world', 'image', 'x', 'y', 'rotation', 'isAtEdge', 'isClicked', 'act', 'move', 'turn', 'turnTowards', 'distanceTo', 'intersects', 'getIntersecting', 'getOneIntersecting', 'isTouching', 'removeTouching'],
  Image: ['width', 'height', 'setColor', 'fill', 'fillRect', 'drawRect', 'fillOval', 'drawOval', 'drawLine', 'drawString', 'drawImage', 'clear', 'scale', 'setTransparency'],
  BluePlayFunctions: ['isKeyDown', 'start', 'stop', 'step', 'getSpeed', 'setSpeed', 'playSound'],
};
function typeName(type: TypeRef): string { return type.displayName; }
function parameters(parameters: CallableMeta['parameters']): string {
  return parameters.map(parameter => `${parameter.name}: ${typeName(parameter.type)}`).join(', ');
}
function methodSignature(method: CallableMeta): string {
  const generic = method.typeParameters?.length ? `<${method.typeParameters.join(', ')}>` : '';
  const result = method.returnType.classifier === 'Unit' ? '' : `: ${typeName(method.returnType)}`;
  return `fun ${method.name}${generic}(${parameters(method.parameters)})${result}`;
}
function classDoc(klass: ManifestClass, summary: string): BluePlayApiDoc {
  const describe = descriptions[klass.name];
  const sorted = <T extends { name: string }>(members: T[]) => members.slice().sort((a, b) => order[klass.name].indexOf(a.name) - order[klass.name].indexOf(b.name));
  return {
    title: `${klass.name} API`, summary,
    sections: [
      { title: 'Constructors', members: klass.constructors.map(constructor => ({
        signature: `${klass.name}(${parameters(constructor.parameters)})`,
        description: describe[`constructor:${constructor.parameters.length === 2 ? '2' : constructor.parameters[0]?.type.classifier}`] || describe.create,
      })) },
      { title: 'Properties', members: sorted(klass.properties.filter(property => property.visibility === 'public')).map(property => ({
        signature: `${property.mutable ? 'var' : 'val'} ${property.name}: ${typeName(property.type)}`, description: describe[property.name],
      })) },
      { title: 'Methods', members: sorted(klass.methods.filter(method => method.visibility === 'public')).map(method => ({ signature: methodSignature(method), description: describe[method.name] })) },
    ],
  };
}
const manifest = metadata as SymbolManifest;
export const bluePlayApiDocs: Record<string, BluePlayApiDoc> = Object.fromEntries([
  ['World.kt', classDoc(manifest.classes.find(klass => klass.name === 'World')!, 'A grid of cells containing actors and a background.')],
  ['Actor.kt', classDoc(manifest.classes.find(klass => klass.name === 'Actor')!, 'A figure with a position, heading and image.')],
  ['Image.kt', classDoc(manifest.classes.find(klass => klass.name === 'Image')!, 'A picture or drawing surface, measured in pixels.')],
  ['BluePlayFunctions.kt', { title: 'BluePlayFunctions API', summary: 'Functions for input, sound and simulation control.', sections: [{ title: 'Functions', members:
    order.BluePlayFunctions.map(name => {
      const method = manifest.functions.find(method => method.name === name)!;
      return { signature: methodSignature(method), description: descriptions.BluePlayFunctions[name] };
    }) }] }],
]);
