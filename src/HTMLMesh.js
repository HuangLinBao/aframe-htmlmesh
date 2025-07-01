// This is a copy of https://github.com/mrdoob/three.js/blob/caddbf4cd84b62d7edf6b9fc937ca709afdfe915/examples/jsm/interactive/HTMLMesh.js
// with the following changes:
// - Keep compatibility with three r147 aframe 1.4.2, still using "this.encoding = sRGBEncoding", otherwise using "this.colorSpace = SRGBColorSpace;"
// - window.dispatchEvent line commented, see the TODO below.
// Look at https://github.com/mrdoob/three.js/commits/dev/examples/jsm/interactive/HTMLMesh.js
// to see if there are other changes that can be retrieved here.
import {
	CanvasTexture,
	LinearFilter,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	SRGBColorSpace,
	sRGBEncoding,
	Color
} from 'three';

/**
 * This class can be used to render a DOM element onto a canvas and use it as a texture
 * for a plane mesh.
 *
 * A typical use case for this class is to render the GUI of `lil-gui` as a texture so it
 * is compatible for VR.
 *
 * ```js
 * const gui = new GUI( { width: 300 } ); // create lil-gui instance
 *
 * const mesh = new HTMLMesh( gui.domElement );
 * scene.add( mesh );
 * ```
 *
 * @augments Mesh
 * @three_import import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
 */
class HTMLMesh extends Mesh {

	/**
	 * Constructs a new HTML mesh.
	 *
	 * @param {HTMLElement} dom - The DOM element to display as a plane mesh.
	 */
	constructor( dom ) {

		const texture = new HTMLTexture( dom );

		const geometry = new PlaneGeometry( texture.image.width * 0.001, texture.image.height * 0.001 );
		const material = new MeshBasicMaterial( { map: texture, toneMapped: false, transparent: true } );

		super( geometry, material );

		function onEvent( event ) {

			material.map.dispatchDOMEvent( event );

		}

		this.addEventListener( 'mousedown', onEvent );
		this.addEventListener( 'mousemove', onEvent );
		this.addEventListener( 'mouseup', onEvent );
		this.addEventListener( 'click', onEvent );

		/**
		 * Frees the GPU-related resources allocated by this instance and removes all event listeners.
		 * Call this method whenever this instance is no longer used in your app.
		 */
		this.dispose = function () {

			geometry.dispose();
			material.dispose();

			material.map.dispose();

			canvases.delete( dom );

			this.removeEventListener( 'mousedown', onEvent );
			this.removeEventListener( 'mousemove', onEvent );
			this.removeEventListener( 'mouseup', onEvent );
			this.removeEventListener( 'click', onEvent );

		};

	}

}

class HTMLTexture extends CanvasTexture {

	constructor( dom ) {

		super( html2canvas( dom ) );

		this.dom = dom;

		this.anisotropy = 16;
		if ( THREE.REVISION === '147' ) { // Keep compatibility with aframe 1.4.2

			this.encoding = sRGBEncoding;

		} else {

			this.colorSpace = SRGBColorSpace;

		}

		this.minFilter = LinearFilter;
		this.magFilter = LinearFilter;
		this.generateMipmaps = false;

		// Create an observer on the DOM, and run html2canvas update in the next loop
		const observer = new MutationObserver( () => {

			if ( ! this.scheduleUpdate ) {

				// ideally should use xr.requestAnimationFrame, here setTimeout to avoid passing the renderer
				this.scheduleUpdate = setTimeout( () => this.update(), 16 );

			}

		} );

		const config = { attributes: true, childList: true, subtree: true, characterData: true };
		observer.observe( dom, config );

		this.observer = observer;

	}

	dispatchDOMEvent( event ) {

		if ( event.data ) {

			htmlevent( this.dom, event.type, event.data.x, event.data.y );

		}

	}

	update() {

		this.image = html2canvas( this.dom );
		this.needsUpdate = true;

		this.scheduleUpdate = null;

	}

	dispose() {

		if ( this.observer ) {

			this.observer.disconnect();

		}

		this.scheduleUpdate = clearTimeout( this.scheduleUpdate );

		super.dispose();

	}

}


//

const canvases = new WeakMap();

function html2canvas( element ) {

	const range = document.createRange();
	const color = new Color();

	function Clipper( context ) {

		const clips = [];
		let isClipping = false;

		function doClip() {

			if ( isClipping ) {

				isClipping = false;
				context.restore();

			}

			if ( clips.length === 0 ) return;

			let minX = - Infinity, minY = - Infinity;
			let maxX = Infinity, maxY = Infinity;

			for ( let i = 0; i < clips.length; i ++ ) {

				const clip = clips[ i ];

				minX = Math.max( minX, clip.x );
				minY = Math.max( minY, clip.y );
				maxX = Math.min( maxX, clip.x + clip.width );
				maxY = Math.min( maxY, clip.y + clip.height );

			}

			context.save();
			context.beginPath();
			context.rect( minX, minY, maxX - minX, maxY - minY );
			context.clip();

			isClipping = true;

		}

		return {

			add: function ( clip ) {

				clips.push( clip );
				doClip();

			},

			remove: function () {

				clips.pop();
				doClip();

			}

		};

	}

	function drawText( style, x, y, string ) {

		if ( string !== '' ) {

			if ( style.textTransform === 'uppercase' ) {

				string = string.toUpperCase();

			}

			context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
			context.textBaseline = 'top';
			context.fillStyle = style.color;
			context.fillText( string, x, y + parseFloat( style.fontSize ) * 0.1 );

		}

	}

	function buildRectPath( x, y, w, h, r ) {

		if ( w < 2 * r ) r = w / 2;
		if ( h < 2 * r ) r = h / 2;

		context.beginPath();
		context.moveTo( x + r, y );
		context.arcTo( x + w, y, x + w, y + h, r );
		context.arcTo( x + w, y + h, x, y + h, r );
		context.arcTo( x, y + h, x, y, r );
		context.arcTo( x, y, x + w, y, r );
		context.closePath();

	}

	function drawBorder( style, which, x, y, width, height ) {

		const borderWidth = style[ which + 'Width' ];
		const borderStyle = style[ which + 'Style' ];
		const borderColor = style[ which + 'Color' ];

		if ( borderWidth !== '0px' && borderStyle !== 'none' && borderColor !== 'transparent' && borderColor !== 'rgba(0, 0, 0, 0)' ) {

			context.strokeStyle = borderColor;
			context.lineWidth = parseFloat( borderWidth );
			context.beginPath();
			context.moveTo( x, y );
			context.lineTo( x + width, y + height );
			context.stroke();

		}

	}

	function parsePseudoContent( content ) {

		if ( ! content || content === 'none' || content === 'normal' ) return '';

		// Remove outer quotes but preserve inner quotes
		content = content.replace( /^['"]|['"]$/g, '' );

		// Handle Unicode escape sequences like \f083, \1F60A, etc.
		content = content.replace( /\\([0-9a-fA-F]{1,6})\s?/g, ( match, hex ) => {

			return String.fromCharCode( parseInt( hex, 16 ) );

		} );

		// Handle escaped quotes
		content = content.replace( /\\'/g, "'" ).replace( /\\"/g, '"' );

		// Handle other common escape sequences
		content = content.replace( /\\n/g, '\n' ).replace( /\\t/g, '\t' );

		return content;

	}

	function calculatePseudoPosition( element, pseudoStyle, parentX, parentY, parentWidth, parentHeight ) {

		const position = pseudoStyle.position;
		const display = pseudoStyle.display;

		if ( display === 'none' ) return null;

		let x = parentX;
		let y = parentY;

		// Parse positioning values
		const left = pseudoStyle.left !== 'auto' ? parseFloat( pseudoStyle.left ) || 0 : 0;
		const top = pseudoStyle.top !== 'auto' ? parseFloat( pseudoStyle.top ) || 0 : 0;
		const right = pseudoStyle.right !== 'auto' ? parseFloat( pseudoStyle.right ) || 0 : null;
		const bottom = pseudoStyle.bottom !== 'auto' ? parseFloat( pseudoStyle.bottom ) || 0 : null;

		if ( position === 'absolute' ) {

			// Absolute positioning relative to nearest positioned ancestor
			x = parentX + left;
			y = parentY + top;

			if ( right !== null && pseudoStyle.left === 'auto' ) {

				x = parentX + parentWidth - right;

			}

			if ( bottom !== null && pseudoStyle.top === 'auto' ) {

				y = parentY + parentHeight - bottom;

			}

		} else if ( position === 'relative' ) {

			// Relative positioning from normal position
			x = parentX + left;
			y = parentY + top;

		} else {

			// Static positioning - normal flow
			x = parentX + left;
			y = parentY + top;

		}

		return { x: x, y: y };

	}

	function renderPseudoElementContent( pseudoStyle, content, x, y, width, height ) {

		const fontSize = parseFloat( pseudoStyle.fontSize ) || 16;
		const lineHeight = parseFloat( pseudoStyle.lineHeight ) || fontSize * 1.2;

		// Handle background
		const backgroundColor = pseudoStyle.backgroundColor;
		if ( backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)' ) {

			context.fillStyle = backgroundColor;
			buildRectPath( x, y, width, height, parseFloat( pseudoStyle.borderRadius ) || 0 );
			context.fill();

		}

		// Handle borders
		const borderWidth = parseFloat( pseudoStyle.borderWidth ) || 0;
		const borderColor = pseudoStyle.borderColor;
		const borderStyle = pseudoStyle.borderStyle;

		if ( borderWidth > 0 && borderStyle !== 'none' && borderColor && borderColor !== 'transparent' ) {

			context.strokeStyle = borderColor;
			context.lineWidth = borderWidth;
			buildRectPath( x, y, width, height, parseFloat( pseudoStyle.borderRadius ) || 0 );
			context.stroke();

		}

		// Handle text content
		if ( content ) {

			const textAlign = pseudoStyle.textAlign || 'left';
			const verticalAlign = pseudoStyle.verticalAlign || 'baseline';

			let textX = x;
			let textY = y;

			// Apply text alignment
			if ( textAlign === 'center' ) {

				textX = x + width / 2;
				context.textAlign = 'center';

			} else if ( textAlign === 'right' ) {

				textX = x + width;
				context.textAlign = 'right';

			} else {

				context.textAlign = 'left';

			}

			// Apply vertical alignment
			if ( verticalAlign === 'middle' ) {

				textY = y + height / 2 - fontSize / 2;

			} else if ( verticalAlign === 'bottom' ) {

				textY = y + height - fontSize;

			}

			// Set up text rendering
			context.font = `${pseudoStyle.fontWeight || 'normal'} ${pseudoStyle.fontStyle || 'normal'} ${fontSize}px ${pseudoStyle.fontFamily || 'Arial'}`;
			context.fillStyle = pseudoStyle.color || '#000000';
			context.textBaseline = 'top';

			// Handle text transform
			const textTransform = pseudoStyle.textTransform;
			if ( textTransform === 'uppercase' ) {

				content = content.toUpperCase();

			} else if ( textTransform === 'lowercase' ) {

				content = content.toLowerCase();

			} else if ( textTransform === 'capitalize' ) {

				content = content.replace( /\b\w/g, ( char ) => char.toUpperCase() );

			}

			// Render text with proper line breaks
			const lines = content.split( '\n' );
			for ( let i = 0; i < lines.length; i ++ ) {

				context.fillText( lines[ i ], textX, textY + i * lineHeight );

			}

			// Reset text align
			context.textAlign = 'left';

		}

	}

	function drawPseudoElement( element, pseudoType, parentX, parentY, parentWidth, parentHeight ) {

		const pseudoStyle = window.getComputedStyle( element, pseudoType );
		const content = parsePseudoContent( pseudoStyle.content );

		// Skip if no content or display: none
		if ( ! content && pseudoStyle.display !== 'block' && pseudoStyle.display !== 'inline-block' ) return;

		const position = calculatePseudoPosition( element, pseudoStyle, parentX, parentY, parentWidth, parentHeight );
		if ( ! position ) return;

		// Calculate dimensions
		let width = parseFloat( pseudoStyle.width ) || 0;
		let height = parseFloat( pseudoStyle.height ) || 0;

		// Auto-size based on content if no explicit dimensions
		if ( width === 0 && content ) {

			context.font = `${pseudoStyle.fontWeight || 'normal'} ${pseudoStyle.fontStyle || 'normal'} ${parseFloat( pseudoStyle.fontSize ) || 16}px ${pseudoStyle.fontFamily || 'Arial'}`;
			const metrics = context.measureText( content );
			width = metrics.width;

		}

		if ( height === 0 && content ) {

			height = parseFloat( pseudoStyle.fontSize ) || 16;

		}

		// Apply padding
		const paddingLeft = parseFloat( pseudoStyle.paddingLeft ) || 0;
		const paddingTop = parseFloat( pseudoStyle.paddingTop ) || 0;
		const paddingRight = parseFloat( pseudoStyle.paddingRight ) || 0;
		const paddingBottom = parseFloat( pseudoStyle.paddingBottom ) || 0;

		const totalWidth = width + paddingLeft + paddingRight;
		const totalHeight = height + paddingTop + paddingBottom;

		// Render the pseudo-element
		renderPseudoElementContent(
			pseudoStyle,
			content,
			position.x,
			position.y,
			totalWidth,
			totalHeight
		);

	}

	function drawElement( element, style ) {

		// Do not render invisible elements, comments and scripts.
		if ( element.nodeType === Node.COMMENT_NODE || element.nodeName === 'SCRIPT' || ( element.style && element.style.display === 'none' ) ) {

			return;

		}

		let x = 0, y = 0, width = 0, height = 0;

		if ( element.nodeType === Node.TEXT_NODE ) {

			// text

			range.selectNode( element );

			const rect = range.getBoundingClientRect();

			x = rect.left - offset.left - 0.5;
			y = rect.top - offset.top - 0.5;
			width = rect.width;
			height = rect.height;

			drawText( style, x, y, element.nodeValue.trim() );

		} else if ( element instanceof HTMLCanvasElement ) {

			// Canvas element

			const rect = element.getBoundingClientRect();

			x = rect.left - offset.left - 0.5;
			y = rect.top - offset.top - 0.5;

			context.save();
			const dpr = window.devicePixelRatio;
			context.scale( 1 / dpr, 1 / dpr );
			context.drawImage( element, x, y );
			context.restore();

		} else if ( element instanceof HTMLImageElement ) {

			const rect = element.getBoundingClientRect();

			x = rect.left - offset.left - 0.5;
			y = rect.top - offset.top - 0.5;
			width = rect.width;
			height = rect.height;

			context.drawImage( element, x, y, width, height );

		} else {

			const rect = element.getBoundingClientRect();

			x = rect.left - offset.left - 0.5;
			y = rect.top - offset.top - 0.5;
			width = rect.width;
			height = rect.height;

			style = window.getComputedStyle( element );

			// Get the border of the element used for fill and border

			buildRectPath( x, y, width, height, parseFloat( style.borderRadius ) );

			const backgroundColor = style.backgroundColor;

			if ( backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)' ) {

				context.fillStyle = backgroundColor;
				context.fill();

			}

			// If all the borders match then stroke the round rectangle

			const borders = [ 'borderTop', 'borderLeft', 'borderBottom', 'borderRight' ];

			let match = true;
			let prevBorder = null;

			for ( const border of borders ) {

				if ( prevBorder !== null ) {

					match = ( style[ border + 'Width' ] === style[ prevBorder + 'Width' ] ) &&
						( style[ border + 'Color' ] === style[ prevBorder + 'Color' ] ) &&
						( style[ border + 'Style' ] === style[ prevBorder + 'Style' ] );

				}

				if ( match === false ) break;

				prevBorder = border;

			}

			if ( match === true ) {

				// They all match so stroke the rectangle from before allows for border-radius

				const width = parseFloat( style.borderTopWidth );

				if ( style.borderTopWidth !== '0px' && style.borderTopStyle !== 'none' && style.borderTopColor !== 'transparent' && style.borderTopColor !== 'rgba(0, 0, 0, 0)' ) {

					context.strokeStyle = style.borderTopColor;
					context.lineWidth = width;
					context.stroke();

				}

			} else {

				// Otherwise draw individual borders

				drawBorder( style, 'borderTop', x, y, width, 0 );
				drawBorder( style, 'borderLeft', x, y, 0, height );
				drawBorder( style, 'borderBottom', x, y + height, width, 0 );
				drawBorder( style, 'borderRight', x + width, y, 0, height );

			}

			if ( element instanceof HTMLInputElement ) {

				let accentColor = style.accentColor;

				if ( accentColor === undefined || accentColor === 'auto' ) accentColor = style.color;

				color.set( accentColor );

				const luminance = Math.sqrt( 0.299 * ( color.r ** 2 ) + 0.587 * ( color.g ** 2 ) + 0.114 * ( color.b ** 2 ) );
				const accentTextColor = luminance < 0.5 ? 'white' : '#111111';

				if ( element.type === 'radio' ) {

					buildRectPath( x, y, width, height, height );

					context.fillStyle = 'white';
					context.strokeStyle = accentColor;
					context.lineWidth = 1;
					context.fill();
					context.stroke();

					if ( element.checked ) {

						buildRectPath( x + 2, y + 2, width - 4, height - 4, height );

						context.fillStyle = accentColor;
						context.strokeStyle = accentTextColor;
						context.lineWidth = 2;
						context.fill();
						context.stroke();

					}

				}

				if ( element.type === 'checkbox' ) {

					buildRectPath( x, y, width, height, 2 );

					context.fillStyle = element.checked ? accentColor : 'white';
					context.strokeStyle = element.checked ? accentTextColor : accentColor;
					context.lineWidth = 1;
					context.stroke();
					context.fill();

					if ( element.checked ) {

						const currentTextAlign = context.textAlign;

						context.textAlign = 'center';

						const properties = {
							color: accentTextColor,
							fontFamily: style.fontFamily,
							fontSize: height + 'px',
							fontWeight: 'bold'
						};

						drawText( properties, x + ( width / 2 ), y, '✔' );

						context.textAlign = currentTextAlign;

					}

				}

				if ( element.type === 'range' ) {

					const [ min, max, value ] = [ 'min', 'max', 'value' ].map( property => parseFloat( element[ property ] ) );
					const position = ( ( value - min ) / ( max - min ) ) * ( width - height );

					buildRectPath( x, y + ( height / 4 ), width, height / 2, height / 4 );
					context.fillStyle = accentTextColor;
					context.strokeStyle = accentColor;
					context.lineWidth = 1;
					context.fill();
					context.stroke();

					buildRectPath( x, y + ( height / 4 ), position + ( height / 2 ), height / 2, height / 4 );
					context.fillStyle = accentColor;
					context.fill();

					buildRectPath( x + position, y, height, height, height / 2 );
					context.fillStyle = accentColor;
					context.fill();

				}

				if ( element.type === 'color' || element.type === 'text' || element.type === 'number' || element.type === 'email' || element.type === 'password' ) {

					clipper.add( { x: x, y: y, width: width, height: height } );

					const displayValue = element.type === 'password' ? '*'.repeat( element.value.length ) : element.value;

					drawText( style, x + parseInt( style.paddingLeft ), y + parseInt( style.paddingTop ), displayValue );

					clipper.remove();

				}

			}

			// Render pseudo-elements (::before and ::after)
			drawPseudoElement( element, '::before', x, y, width, height );
			drawPseudoElement( element, '::after', x, y, width, height );

		}

		/*
		// debug
		context.strokeStyle = '#' + Math.random().toString( 16 ).slice( - 3 );
		context.strokeRect( x - 0.5, y - 0.5, width + 1, height + 1 );
		*/

		const isClipping = style.overflow === 'auto' || style.overflow === 'hidden';

		if ( isClipping ) clipper.add( { x: x, y: y, width: width, height: height } );

		for ( let i = 0; i < element.childNodes.length; i ++ ) {

			drawElement( element.childNodes[ i ], style );

		}

		if ( isClipping ) clipper.remove();

	}

	const offset = element.getBoundingClientRect();

	let canvas = canvases.get( element );

	if ( canvas === undefined ) {

		canvas = document.createElement( 'canvas' );
		canvas.width = offset.width;
		canvas.height = offset.height;
		canvases.set( element, canvas );

	}

	const context = canvas.getContext( '2d'/*, { alpha: false }*/ );

	const clipper = new Clipper( context );

	// console.time( 'drawElement' );

	context.clearRect( 0, 0, canvas.width, canvas.height );

	drawElement( element );

	// console.timeEnd( 'drawElement' );

	return canvas;

}

function htmlevent( element, event, x, y ) {

	const mouseEventInit = {
		clientX: ( x * element.offsetWidth ) + element.offsetLeft,
		clientY: ( y * element.offsetHeight ) + element.offsetTop,
		view: element.ownerDocument.defaultView
	};

	// TODO: Find out why this is added. Keep commented out when this file is updated
	// window.dispatchEvent( new MouseEvent( event, mouseEventInit ) );

	const rect = element.getBoundingClientRect();

	x = x * rect.width + rect.left;
	y = y * rect.height + rect.top;

	function traverse( element ) {

		if ( element.nodeType !== Node.TEXT_NODE && element.nodeType !== Node.COMMENT_NODE ) {

			const rect = element.getBoundingClientRect();

			if ( x > rect.left && x < rect.right && y > rect.top && y < rect.bottom ) {

				element.dispatchEvent( new MouseEvent( event, mouseEventInit ) );

				if ( element instanceof HTMLInputElement && element.type === 'range' && ( event === 'mousedown' || event === 'click' ) ) {

					const [ min, max ] = [ 'min', 'max' ].map( property => parseFloat( element[ property ] ) );

					const width = rect.width;
					const offsetX = x - rect.x;
					const proportion = offsetX / width;
					element.value = min + ( max - min ) * proportion;
					element.dispatchEvent( new InputEvent( 'input', { bubbles: true } ) );

				}

				if ( element instanceof HTMLInputElement && ( element.type === 'text' || element.type === 'number' || element.type === 'email' || element.type === 'password' ) && ( event === 'mousedown' || event === 'click' ) ) {

					element.focus();

				}

			}

			for ( let i = 0; i < element.childNodes.length; i ++ ) {

				traverse( element.childNodes[ i ] );

			}

		}

	}

	traverse( element );

}

export { HTMLMesh };
