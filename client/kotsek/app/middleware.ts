// middleware.ts (place in root directory)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the path of the request
  const path = request.nextUrl.pathname;
  
  // Define protected routes
  const protectedRoutes = ['/detect'];
  
  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  
  // If it's not a protected route, no need to check anything
  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  
  // Get the token from the session storage
  // Note: Middleware runs on the server, so we need to check cookies, not sessionStorage
  const token = request.cookies.get('access_token')?.value;
  
  // If no token is found, redirect to login
  if (!token) {
    // Create a URL for the login page
    const loginUrl = new URL('/login', request.url);
    // Add a redirect parameter to come back to this page after login
    loginUrl.searchParams.set('redirectTo', path);
    
    // Redirect to login
    return NextResponse.redirect(loginUrl);
  }
  
  // If token exists, allow access to the protected route
  return NextResponse.next();
}

// Configure which paths Middleware will run on
export const config = {
  matcher: ['/detect/:path*']
};