// Any other /api/… path is a JSON 404, rather than the app's index.html
export const onRequest: PagesFunction = () => Response.json({ error: 'Not found' }, { status: 404 });
