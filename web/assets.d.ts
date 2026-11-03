// esbuild's text loader turns an imported .svg into its markup
declare module '*.svg' {
  const markup: string;
  export default markup;
}

// CSS imports are bundled into public/build/main.css
declare module '*.css';
