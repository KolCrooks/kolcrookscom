<script lang="ts">
    import { T } from '@threlte/core'
    import { AutoColliders, Collider } from '@threlte/rapier'
  </script>
  
<T.Group position={[0, -0.5, 0]}>
    <Collider 
        shape={'cuboid'}
        args={[10, 1, 10]}
        type={'static'}
    />
</T.Group>